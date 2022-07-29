/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Buffer } from 'buffer';

import { FIT } from './fit';
import type { Options } from './fit-parser';
import { getFitMessage, getFitMessageBaseType } from './messages';

type Message = {
  messageType: string;
  nextIndex: number;
  message?: Record<string, unknown>;
};

export type FieldDefinition = {
  type: string;
  fDefNo: number;
  size: number;
  endianAbility: boolean;
  littleEndian: boolean;
  baseTypeNo: number;
  name: string;
  dataType: number;
};

export type DeveloperFieldDefinition = FieldDefinition & {
  scale: number;
  offset: number;
  developerDataIndex: number;
  isDeveloperField: boolean;
};

const COMPRESSED_TIME_MASK = 31;
const COMPRESSED_LOCAL_MESG_NUM_MASK = 0x60;
const COMPRESSED_HEADER_MASK = 0x80;
const DEFINITION_MESSAGE_MASK = 0x40;
const DEVELOPER_DATA_MASK = 0x20;
const LOCAL_MESSAGE_TYPE_MASK = 0x0f;
const GARMIN_TIME_OFFSET = 631065600000;

export default class Binary {
  timestamp = 0;
  lastTimeOffset = 0;
  monitoring_timestamp = 0;

  readRecord(
    blob: Uint8Array,
    messageTypes: {
      littleEndian: boolean;
      globalMessageNumber: number;
      numberOfFields: number;
      fieldDefs: FieldDefinition[];
    }[],
    developerFields: Record<string, unknown>[][],
    startIndex: number,
    options: Options,
    startDate: number,
    pausedTime: number,
  ): Message {
    const recordHeader = blob[startIndex]!;
    let localMessageType = recordHeader & LOCAL_MESSAGE_TYPE_MASK;

    if (this.isCompressedTimestampDataMessage(recordHeader)) {
      const timeoffset = recordHeader & COMPRESSED_TIME_MASK;
      this.timestamp += (timeoffset - this.lastTimeOffset) & COMPRESSED_TIME_MASK;
      this.lastTimeOffset = timeoffset;

      localMessageType = (recordHeader & COMPRESSED_LOCAL_MESG_NUM_MASK) >> 5;
    } else if (this.isDefinitionMessageHeader(recordHeader)) {
      // Definition messages are used to associate local data message types to the global FIT message profile
      // They describe the architecture, format, and fields of upcoming data messages

      /**
       * The record header is a one byte bit field. It indicates whether the record content contains a definition message,
       * a normal data message or a compressed timestamp data message
       */
      const hasDeveloperData = this.messageHasDeveloperData(recordHeader);
      /** Architecture type */
      const isLittleEndian = blob[startIndex + 2] === 0;
      /** Number of fields in the data messages */
      const numberOfFields = blob[startIndex + 5]!;
      /** Number of Self Descriptive fields in the Data Message */
      const numberOfDeveloperDataFields = hasDeveloperData ? blob[startIndex + 5 + numberOfFields * 3 + 1]! : 0;

      const mTypeDef: {
        littleEndian: boolean;
        globalMessageNumber: number;
        numberOfFields: number;
        fieldDefs: FieldDefinition[];
      } = {
        littleEndian: isLittleEndian,
        globalMessageNumber: this.addEndian(isLittleEndian, [blob[startIndex + 3]!, blob[startIndex + 4]!]),
        numberOfFields: numberOfFields + numberOfDeveloperDataFields,
        fieldDefs: [],
      };

      const message = getFitMessage(mTypeDef.globalMessageNumber);

      for (let i = 0; i < numberOfFields; i++) {
        const fDefIndex = startIndex + 6 + i * 3;
        /** Defined in the Global FIT profile for the specified FIT message */
        const fieldDefinitionNumber = blob[fDefIndex]!;
        /** Base type of the specified message's field (unsigned char, signed short, etc) */
        const baseType = blob[fDefIndex + 2]!;
        /** Size (in bytes) of the specified message's field */
        const size = blob[fDefIndex + 1]!;
        const { field, type } = message.getAttributes(blob[fDefIndex]!);
        const fDef: FieldDefinition = {
          type,
          fDefNo: fieldDefinitionNumber,
          size,
          endianAbility: (baseType & 128) === 128,
          littleEndian: isLittleEndian,
          baseTypeNo: baseType & 15,
          name: field,
          dataType: getFitMessageBaseType(baseType & 15),
        };

        mTypeDef.fieldDefs.push(fDef);
      }

      for (let i = 0; i < numberOfDeveloperDataFields; i++) {
        const fDefIndex = startIndex + 6 + numberOfFields * 3 + 1 + i * 3;

        const fieldNum = blob[fDefIndex]!;
        const size = blob[fDefIndex + 1]!;
        const devDataIndex = blob[fDefIndex + 2]!;

        const devDef = developerFields[devDataIndex]![fieldNum]!;

        const baseType = devDef['fit_base_type_id'] as number;

        const fDef: DeveloperFieldDefinition = {
          type: FIT.types['fit_base_type']![baseType] as string,
          fDefNo: fieldNum,
          size: size,
          endianAbility: (baseType & 128) === 128,
          littleEndian: isLittleEndian,
          baseTypeNo: baseType & 15,
          name: devDef['field_name'] as string,
          dataType: getFitMessageBaseType(baseType & 15),
          scale: (devDef['scale'] as number) || 1,
          offset: (devDef['offset'] as number) || 0,
          developerDataIndex: devDataIndex,
          isDeveloperField: true,
        };

        mTypeDef.fieldDefs.push(fDef);
      }

      messageTypes[localMessageType] = mTypeDef;

      const nextIndex = startIndex + 6 + mTypeDef.numberOfFields * 3;
      const nextIndexWithDeveloperData = nextIndex + 1;

      return {
        messageType: 'definition',
        nextIndex: hasDeveloperData ? nextIndexWithDeveloperData : nextIndex,
      };
    }

    const messageType = messageTypes[localMessageType] || messageTypes[0]!;

    // TODO: handle compressed header ((recordHeader & 128) == 128)

    // uncompressed header
    let messageSize = 0;
    let readDataFromIndex = startIndex + 1;
    const fields: Record<string, unknown> = {};
    const message = getFitMessage(messageType.globalMessageNumber);

    for (let i = 0; i < messageType.fieldDefs.length; i++) {
      const fDef = messageType.fieldDefs[i]!;
      const data = this.readData(blob, fDef, readDataFromIndex);

      if (!this.isInvalidValue(data, fDef.type)) {
        if (this.isDeveloperFieldDefinition(fDef)) {
          const field = fDef.name;
          const type = fDef.type;
          const scale = fDef.scale;
          const offset = fDef.offset;

          fields[fDef.name] = this.applyOptions(this.formatByType(data, type, scale, offset), field, options);
        } else {
          const { field, type, scale, offset } = message.getAttributes(fDef.fDefNo);

          if (field !== 'unknown' && field !== '' && field !== undefined) {
            fields[field] = this.applyOptions(this.formatByType(data, type, scale, offset), field, options);
          }
        }

        if (message.name === 'record' && options.elapsedRecordField) {
          fields['elapsed_time'] = ((fields['timestamp'] as number) - startDate) / 1000;
          fields['timer_time'] = (fields['elapsed_time'] as number) - pausedTime;
        }
      }

      readDataFromIndex += fDef.size;
      messageSize += fDef.size;
    }

    if (message.name === 'field_description') {
      developerFields[fields['developer_data_index'] as number] =
        developerFields[fields['developer_data_index'] as number] || [];
      developerFields[fields['developer_data_index'] as number]![fields['field_definition_number'] as number] = fields;
    }

    if (message.name === 'monitoring') {
      //we need to keep the raw timestamp value so we can calculate subsequent timestamp16 fields
      if (fields['timestamp']) {
        this.monitoring_timestamp = fields['timestamp'] as number;
        fields['timestamp'] = new Date((fields['timestamp'] as number) * 1000 + GARMIN_TIME_OFFSET);
      }
      if ((fields['timestamp16'] as number) && !(fields['timestamp'] as number)) {
        this.monitoring_timestamp +=
          ((fields['timestamp16'] as number) - (this.monitoring_timestamp & 0xffff)) & 0xffff;
        //fields.timestamp = monitoring_timestamp;
        fields['timestamp'] = new Date(this.monitoring_timestamp * 1000 + GARMIN_TIME_OFFSET);
      }
    }

    const result = {
      messageType: message.name,
      nextIndex: startIndex + messageSize + 1,
      message: fields,
    };

    return result;
  }

  private addEndian(littleEndian: boolean, bytes: number[]): number {
    let result = 0;
    if (!littleEndian) bytes.reverse();
    for (let i = 0; i < bytes.length; i++) {
      result += (bytes[i]! << (i << 3)) >>> 0;
    }

    return result;
  }

  private readData(blob: Uint8Array, fDef: FieldDefinition, startIndex: number): number | number[] | string {
    if (fDef.type === 'string') {
      const temp: number[] = [];
      for (let i = 0; i < fDef.size; i++) {
        if (blob[startIndex + i]) {
          temp.push(blob[startIndex + i]!);
        }
      }
      return Buffer.from(temp).toString('utf-8');
    }

    if (fDef.type === 'byte_array') {
      const temp: number[] = [];
      for (let i = 0; i < fDef.size; i++) {
        temp.push(blob[startIndex + i]!);
      }
      return temp;
    }

    const temp: number[] = [];
    for (let i = 0; i < fDef.size; i++) {
      temp.push(blob[startIndex + i]!);
    }

    const buffer = new Uint8Array(temp).buffer;
    const dataView = new DataView(buffer);

    try {
      switch (fDef.type) {
        case 'sint8':
          return dataView.getInt8(0);
        case 'uint8':
          return dataView.getUint8(0);
        case 'sint16':
          return dataView.getInt16(0, fDef.littleEndian);
        case 'uint16':
        case 'uint16z':
          return dataView.getUint16(0, fDef.littleEndian);
        case 'sint32':
          return dataView.getInt32(0, fDef.littleEndian);
        case 'uint32':
        case 'uint32z':
          return dataView.getUint32(0, fDef.littleEndian);
        case 'float32':
          return dataView.getFloat32(0, fDef.littleEndian);
        case 'float64':
          return dataView.getFloat64(0, fDef.littleEndian);
        case 'uint32_array':
          const array32 = [];
          for (let i = 0; i < fDef.size; i += 4) {
            array32.push(dataView.getUint32(i, fDef.littleEndian));
          }
          return array32;
        case 'uint16_array':
          const array = [];
          for (let i = 0; i < fDef.size; i += 2) {
            array.push(dataView.getUint16(i, fDef.littleEndian));
          }
          return array;
      }
    } catch (e) {
      throw e;
    }

    return this.addEndian(fDef.littleEndian, temp);
  }

  private formatByType(
    data: number | number[] | string,
    type: string,
    scale: number | undefined,
    offset: number | undefined,
  ): unknown {
    switch (type) {
      case 'date_time':
      case 'local_date_time':
        return new Date((data as number) * 1000 + GARMIN_TIME_OFFSET);
      case 'sint32':
        return (data as number) * FIT.scConst;
      case 'uint8':
      case 'sint16':
      case 'uint32':
      case 'uint16':
        return scale ? (data as number) / scale + (offset || 0) : data;
      case 'uint32_array':
      case 'uint16_array':
        return (data as number[]).map((dataItem) => (scale ? dataItem / scale + (offset || 0) : dataItem));
      default:
        if (!FIT.types[type]) {
          return data;
        }
        // Quick check for a mask
        const mask = Object.entries(FIT.types[type]!).find(([_key, value]) => value === 'mask')?.[0];
        if (!mask) {
          return FIT.types[type]![data as number];
        }
        const dataItem: Record<string, unknown> = {};
        Object.entries(FIT.types[type]!).forEach(([key, value]) => {
          const k = parseInt(key, 10);
          if (value === 'mask') {
            dataItem['value'] = (data as number) & k;
          } else {
            dataItem[FIT.types[type]![k]!] = !!(((data as number) & k) >> 7); // Not sure if we need the >> 7 and casting to boolean but from all the masked props of fields so far this seems to be the case
          }
        });
        return dataItem;
    }
  }

  private isInvalidValue(data: string | number | number[], type: string): boolean {
    switch (type) {
      case 'enum':
        return data === 0xff;
      case 'sint8':
        return data === 0x7f;
      case 'uint8':
        return data === 0xff;
      case 'sint16':
        return data === 0x7fff;
      case 'uint16':
        return data === 0xffff;
      case 'sint32':
        return data === 0x7fffffff;
      case 'uint32':
        return data === 0xffffffff;
      case 'string':
        return data === 0x00;
      case 'float32':
        return data === 0xffffffff;
      case 'float64':
        return data === 0xffffffffffffffff; // eslint-disable-line @typescript-eslint/no-loss-of-precision
      case 'uint8z':
        return data === 0x00;
      case 'uint16z':
        return data === 0x0000;
      case 'uint32z':
        return data === 0x000000;
      case 'byte':
        return data === 0xff;
      case 'sint64':
        return data === 0x7fffffffffffffff; // eslint-disable-line @typescript-eslint/no-loss-of-precision
      case 'uint64':
        return data === 0xffffffffffffffff; // eslint-disable-line @typescript-eslint/no-loss-of-precision
      case 'uint64z':
        return data === 0x0000000000000000;
      default:
        return false;
    }
  }

  private convertTo(data: number, unitsList: string, speedUnit: string): number {
    const unitObj = FIT.options[unitsList]![speedUnit];
    return unitObj ? data * unitObj.multiplier + unitObj.offset : data;
  }

  private applyOptions(data: unknown, field: string, options: Options): unknown {
    switch (field) {
      case 'speed':
      case 'enhanced_speed':
      case 'vertical_speed':
      case 'avg_speed':
      case 'max_speed':
      case 'speed_1s':
      case 'ball_speed':
      case 'enhanced_avg_speed':
      case 'enhanced_max_speed':
      case 'avg_pos_vertical_speed':
      case 'max_pos_vertical_speed':
      case 'avg_neg_vertical_speed':
      case 'max_neg_vertical_speed':
        return this.convertTo(data as number, 'speedUnits', options.speedUnit);
      case 'distance':
      case 'total_distance':
      case 'enhanced_avg_altitude':
      case 'enhanced_min_altitude':
      case 'enhanced_max_altitude':
      case 'enhanced_altitude':
      case 'height':
      case 'odometer':
      case 'avg_stroke_distance':
      case 'min_altitude':
      case 'avg_altitude':
      case 'max_altitude':
      case 'total_ascent':
      case 'total_descent':
      case 'altitude':
      case 'cycle_length':
      case 'auto_wheelsize':
      case 'custom_wheelsize':
      case 'gps_accuracy':
        return this.convertTo(data as number, 'lengthUnits', options.lengthUnit);
      case 'temperature':
      case 'avg_temperature':
      case 'max_temperature':
        return this.convertTo(data as number, 'temperatureUnits', options.temperatureUnit);
      default:
        return data;
    }
  }

  private isCompressedTimestampDataMessage(recordHeader: number): boolean {
    return (recordHeader & COMPRESSED_HEADER_MASK) === COMPRESSED_HEADER_MASK;
  }

  private messageHasDeveloperData(recordHeader: number): boolean {
    return (recordHeader & DEVELOPER_DATA_MASK) === DEVELOPER_DATA_MASK;
  }

  private isDefinitionMessageHeader(recordHeader: number): boolean {
    return (recordHeader & DEFINITION_MESSAGE_MASK) === DEFINITION_MESSAGE_MASK;
  }

  isDeveloperFieldDefinition = (def: FieldDefinition): def is DeveloperFieldDefinition => 'isDeveloperField' in def;

  calculateCRC(blob: Uint8Array, start: number, end: number): number {
    const crcTable = [
      0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01,
      0x8801, 0x4400,
    ];

    let crc = 0;
    for (let i = start; i < end; i++) {
      const byteVal = blob[i]!;
      let tmp = crcTable[crc & 0xf]!;
      crc = (crc >> 4) & 0x0fff;
      crc = crc ^ tmp ^ crcTable[byteVal & 0xf]!;
      tmp = crcTable[crc & 0xf]!;
      crc = (crc >> 4) & 0x0fff;
      crc = crc ^ tmp ^ crcTable[(byteVal >> 4) & 0xf]!;
    }

    return crc;
  }
}
