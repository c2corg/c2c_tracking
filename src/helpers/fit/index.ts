/* eslint-disable security/detect-object-injection */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
// This code is heavily inspired from https://github.com/backfit/backfit, under MIT license
// see LICENSE file in this directory
// The FIT format specification: https://developer.garmin.com/fit/protocol/

import type { LineString } from 'src/repository/geojson';

type MessageType = { globalMessageNumber: number; littleEndian: boolean; fieldDefinitions: FieldDefinition[] };

type DeveloperFieldDefinition = {
  size: number;
  isDeveloperField: true;
};

type FieldDefinition =
  | {
      size: number;
      fieldDefinitionNumber: number;
      littleEndian: boolean;
      baseType: number;
    }
  | DeveloperFieldDefinition;

type RecordMessage = {
  messageType: 'record';
  nextIndex: number;
  message: RecordValues;
};

type Message =
  | {
      messageType: 'definition' | 'record' | 'other';
      nextIndex: number;
    }
  | RecordMessage;

type RecordValues = { timestamp?: Date; longitude?: number; latitude?: number; altitude?: number };

const isDeveloperFieldDefinition = (def: FieldDefinition): def is DeveloperFieldDefinition =>
  'isDeveloperField' in def && def.isDeveloperField === true;

const isRecordMessage = (message: Message): message is RecordMessage => message.messageType === 'record';

const POSITION_SCALE = 180 / Math.pow(2, 31);
const GARMIN_TIME_OFFSET = 631065600000;
/** If the 5th bit of record header is set, we have developer data */
const DEVELOPER_DATA_MASK = 32;
/** if the 7th bit of record header is 1, we have a definition message, else a data message */
const DEFINITION_MESSAGE_MASK = 64;
/** the last 4 bits of the record header define the local message type */
const LOCAL_MESSAGE_TYPE_MASK = 15;
/** the last bit of the header indicates whether we have a compressed header or not */
const COMPRESSED_HEADER_MASK = 128;
/** The five least significant bits of the header represent the compressed timestamp, in seconds, from a fixed time reference */
const COMPRESSED_TIME_MASK = 31;
/** For compressed header, the local message type is bits 6-7 */
const COMPRESSED_LOCAL_MESSAGE_NUMBER_MASK = 96;

const RECORD_GLOBAL_MESSAGE_NUMBER = 20;
const TIMESTAMP_FIELD_DEFINITION_NUMBER = 253;
const LATITUDE_FIELD_DEFINITION_NUMBER = 0;
const LONGITUDE_FIELD_DEFINITION_NUMBER = 1;
const ELEVATION_FIELD_DEFINITION_NUMBER = 2;

/** Field base types. Only base types that we need are defined */
const BASE_TYPES: Record<number, { name: string; invalidValue: number; size: number }> = {
  [0x84]: {
    name: 'uint16',
    invalidValue: 0xffff,
    size: 2,
  },
  [0x85]: {
    name: 'sint32',
    invalidValue: 0x7fffffff,
    size: 4,
  },
  [0x86]: {
    name: 'uint32',
    invalidValue: 0xffffffff,
    size: 4,
  },
};

class FIT {
  private timestamp = 0;
  private lastTimeOffset = 0;
  private lastAltitude: number | undefined;
  private messageTypes: MessageType[] = [];

  private addEndian(littleEndian: boolean, bytes: number[]): number {
    let result = 0;
    if (!littleEndian) {
      bytes.reverse();
    }
    for (let i = 0; i < bytes.length; i++) {
      result += (bytes[i]! << (i << 3)) >>> 0;
    }

    return result;
  }

  private readData(blob: Uint8Array, baseType: number, littleEndian: boolean, startIndex: number): number {
    const { name: type, size } = BASE_TYPES[baseType]!;

    const tmp: number[] = [];
    for (let i = 0; i < size; i++) {
      tmp.push(blob[startIndex + i]!);
    }

    const buffer = new Uint8Array(tmp).buffer;
    const dataView = new DataView(buffer);

    switch (type) {
      case 'uint16':
        return dataView.getUint16(0, littleEndian);
      case 'sint32':
        return dataView.getInt32(0, littleEndian);
      case 'uint32':
        return dataView.getUint32(0, littleEndian);
    }

    return this.addEndian(littleEndian, tmp);
  }

  private isInvalidValue(data: number, baseType: number): boolean {
    const { invalidValue } = BASE_TYPES[baseType]!;
    return data === invalidValue;
  }

  private isDefinitionMessage(recordHeader: number): boolean {
    return (recordHeader & DEFINITION_MESSAGE_MASK) === DEFINITION_MESSAGE_MASK;
  }

  private isCompressedTimestampDataMessage(recordHeader: number): boolean {
    return (recordHeader & COMPRESSED_HEADER_MASK) === COMPRESSED_HEADER_MASK;
  }

  private hasDeveloperData(recordHeader: number): boolean {
    return (recordHeader & DEVELOPER_DATA_MASK) === DEVELOPER_DATA_MASK;
  }

  private getFileTypeString(blob: Uint8Array): string {
    let fileTypeString = '';
    for (let i = 8; i < 12; i++) {
      fileTypeString += String.fromCharCode(blob[i]!);
    }
    return fileTypeString;
  }

  private readTimestamp(blob: Uint8Array, startIndex: number, fieldDefinitions: FieldDefinition[]): number | null {
    let readDataFromIndex = startIndex + 1;
    for (let i = 0; i < fieldDefinitions.length; i++) {
      const def = fieldDefinitions[i]!;
      if (isDeveloperFieldDefinition(def)) {
        // we won't find a timestamp field later on
        return null;
      }
      const { size, fieldDefinitionNumber, littleEndian, baseType } = def;
      if (fieldDefinitionNumber === TIMESTAMP_FIELD_DEFINITION_NUMBER) {
        const data = this.readData(blob, baseType, littleEndian, readDataFromIndex);
        if (this.isInvalidValue(data, baseType)) {
          return null;
        }

        return data;
      }
      readDataFromIndex += size;
    }
    return null;
  }

  private readDeveloperFieldDefinition(
    blob: Uint8Array,
    startIndex: number,
    numberOfFields: number,
    fieldIndex: number,
  ): DeveloperFieldDefinition {
    const fieldDefinitionIndex = startIndex + 6 + numberOfFields * 3 + 1 + fieldIndex * 3;
    /** Size (in bytes) of the specified message's field */
    const size = blob[fieldDefinitionIndex + 1]!;

    return {
      size,
      isDeveloperField: true,
    };
  }

  private readFieldDefinition(
    blob: Uint8Array,
    startIndex: number,
    fieldIndex: number,
    isLittleEndian: boolean,
  ): FieldDefinition {
    const fieldDefinitionIndex = startIndex + 6 + fieldIndex * 3;
    /** Defined in the Global FIT profile for the specified FIT message */
    const fieldDefinitionNumber = blob[fieldDefinitionIndex]!;
    /** Base type of the specified message's field (unsigned char, signed short, etc) */
    const baseType = blob[fieldDefinitionIndex + 2]!;
    /** Size (in bytes) of the specified message's field */
    const size = blob[fieldDefinitionIndex + 1]!;

    return {
      baseType,
      fieldDefinitionNumber,
      size,
      littleEndian: isLittleEndian,
    };
  }

  private readDefinitionMessage(blob: Uint8Array, startIndex: number): Message {
    // Definition messages are used to associate local data message types to the global FIT message profile
    // They describe the architecture, format, and fields of upcoming data messages

    /**
     * The record header is a one byte bit field. It indicates whether the record content contains a definition message,
     * a normal data message or a compressed timestamp data message
     */
    const recordHeader = blob[startIndex]!;
    const hasDeveloperData = this.hasDeveloperData(recordHeader);
    /** Used to create an association between the definition message, data message and the FIT message in the Global FIT Profile. */
    const localMessageType = recordHeader & LOCAL_MESSAGE_TYPE_MASK;
    /** Architecture type */
    const isLittleEndian = blob[startIndex + 2]! === 0;
    /** Number of fields in the data messages */
    const numberOfFields = blob[startIndex + 5]!;
    /** Number of Self Descriptive fields in the Data Message */
    const numberOfDeveloperDataFields = hasDeveloperData ? blob[startIndex + 5 + numberOfFields * 3 + 1]! : 0;
    /** Global message number, unique to each message. Endianness of the 2 bytes value is defined in the architecture byte */
    const globalMessageNumber = this.addEndian(isLittleEndian, [blob[startIndex + 3]!, blob[startIndex + 4]!]);

    const nextIndex = startIndex + 6 + (numberOfFields + numberOfDeveloperDataFields) * 3 + (hasDeveloperData ? 1 : 0);

    this.messageTypes[localMessageType] = {
      littleEndian: isLittleEndian,
      globalMessageNumber,
      fieldDefinitions: [
        ...[...Array(numberOfFields).keys()].map((i) => this.readFieldDefinition(blob, startIndex, i, isLittleEndian)),
        ...[...Array(numberOfDeveloperDataFields).keys()].map((i) =>
          this.readDeveloperFieldDefinition(blob, startIndex, numberOfFields, i),
        ),
      ],
    };

    return {
      messageType: 'definition',
      nextIndex,
    };
  }

  private readDataMessage(blob: Uint8Array, startIndex: number): Message {
    /**
     * The record header is a one byte bit field. It indicates whether the record content contains a definition message,
     * a normal data message or a compressed timestamp data message
     */
    const recordHeader = blob[startIndex]!;

    const isCompressedTimestampDataMessage = this.isCompressedTimestampDataMessage(recordHeader);

    /**
     * The local message type is used to create an association between the definition message,
     * data message and the FIT message in the Global FIT Profile.
     *
     * For a compressed timestamp header, only 2 bits are allocated for the local message type.
     * As a result, the use of this special header is restricted to local message types 0–3,
     * and cannot be used for local message types 4–15.
     */
    const localMessageType = isCompressedTimestampDataMessage
      ? (recordHeader & COMPRESSED_LOCAL_MESSAGE_NUMBER_MASK) >> 5
      : recordHeader & LOCAL_MESSAGE_TYPE_MASK;

    /** Get the message type from the definitions */
    const messageType = this.messageTypes[localMessageType];
    if (!messageType) {
      throw new Error('Missing message definition for local message number');
    }
    const { globalMessageNumber, fieldDefinitions } = messageType;

    let messageSize = 0;
    let readDataFromIndex = startIndex + 1;
    const fields: RecordValues = {};

    if (globalMessageNumber !== RECORD_GLOBAL_MESSAGE_NUMBER) {
      const messageSize = fieldDefinitions.reduce((total, current) => total + current.size, 0);
      return {
        messageType: 'other',
        nextIndex: startIndex + messageSize + 1,
      };
    }

    if (!isCompressedTimestampDataMessage) {
      // If the data message has a timestamp, store it as the new time reference
      // for compressed timestamps
      const timestamp = this.readTimestamp(blob, startIndex, fieldDefinitions);
      if (timestamp !== null) {
        this.timestamp = timestamp;
        this.lastTimeOffset = this.timestamp & COMPRESSED_TIME_MASK;
      }
    } else {
      // The five least significant bits of the header represent the compressed timestamp, in seconds,
      // from the time reference.
      const timeOffset = recordHeader & COMPRESSED_TIME_MASK;
      this.timestamp += (timeOffset - this.lastTimeOffset) & COMPRESSED_TIME_MASK;
      this.lastTimeOffset = timeOffset;

      // Add the computed timestamp to the fields
      fields.timestamp = new Date(this.timestamp * 1000 + GARMIN_TIME_OFFSET);
    }

    for (let i = 0; i < fieldDefinitions.length; i++) {
      const def = fieldDefinitions[i]!;
      if (isDeveloperFieldDefinition(def)) {
        // We don't care about dev-specific data
        messageSize += def.size;
        readDataFromIndex += def.size;
        continue;
      }

      const { size, fieldDefinitionNumber, baseType, littleEndian } = def;
      const isFieldOfInterest = [
        TIMESTAMP_FIELD_DEFINITION_NUMBER,
        LONGITUDE_FIELD_DEFINITION_NUMBER,
        LATITUDE_FIELD_DEFINITION_NUMBER,
        ELEVATION_FIELD_DEFINITION_NUMBER,
      ].includes(fieldDefinitionNumber);

      messageSize += size;

      // We only care about some specific fields
      if (!isFieldOfInterest) {
        readDataFromIndex += size;
        continue;
      }

      const data = this.readData(blob, baseType, littleEndian, readDataFromIndex);
      readDataFromIndex += size;

      if (this.isInvalidValue(data, baseType)) {
        continue;
      }

      switch (fieldDefinitionNumber) {
        case TIMESTAMP_FIELD_DEFINITION_NUMBER:
          fields.timestamp = new Date(data * 1000 + GARMIN_TIME_OFFSET);
          break;
        case LONGITUDE_FIELD_DEFINITION_NUMBER:
          fields.longitude = data * POSITION_SCALE;
          break;
        case LATITUDE_FIELD_DEFINITION_NUMBER:
          fields.latitude = data * POSITION_SCALE;
          break;
        case ELEVATION_FIELD_DEFINITION_NUMBER:
          fields.altitude = data / 5 - 500;
          /** Stores the last altitude set, in order to fill 'holes' */
          this.lastAltitude = fields.altitude;
          break;
      }
    }

    return {
      messageType: 'record',
      nextIndex: startIndex + messageSize + 1,
      message: fields,
    };
  }

  private readRecord(blob: Uint8Array, startIndex: number): Message {
    /**
     * The record header is a one byte bit field. It indicates whether the record content contains a definition message,
     * a normal data message or a compressed timestamp data message
     */
    const recordHeader = blob[startIndex]!;

    return this.isDefinitionMessage(recordHeader)
      ? this.readDefinitionMessage(blob, startIndex)
      : this.readDataMessage(blob, startIndex);
  }

  readFeatures(blob: Uint8Array): LineString {
    if (blob.length < 12) {
      throw new Error('File to small to be a FIT file');
    }

    /**
     * Indicates the lenght of the FIT file header including header size.
     * The 12 byte header is considered legacy, using the 14 byte header is preferred.
     * Computing the CRC is optional when using a 14 byte file header, it is permissible to set it to 0x0000.
     */
    const headerSize = blob[0];
    /** Length of the data records section in bytes. Does not include Header or CRC */
    const dataLength = blob[4]! + (blob[5]! << 8) + (blob[6]! << 16) + (blob[7]! << 24);
    /** ASCII values for "".FIT". A FIT binary file opened with a text editor will contain a readable ".FIT" in the first line. */
    const fileTypeString = this.getFileTypeString(blob);

    // Some basic checks. Note that we don't try to check file or header CRC
    if (headerSize !== 14 && headerSize !== 12) {
      throw new Error(`Incorrect header size: ${headerSize}`);
    }

    if (fileTypeString !== '.FIT') {
      throw new Error("Missing '.FIT' in header");
    }

    /** Message types from definitions*/
    this.messageTypes = [];
    /** Time reference for upcoming compressed messages */
    this.timestamp = 0;
    const geometry: LineString = { coordinates: [], type: 'LineString' };
    let loopIndex = headerSize;

    while (loopIndex < headerSize + dataLength) {
      const msg = this.readRecord(blob, loopIndex);
      loopIndex = msg.nextIndex;

      if (isRecordMessage(msg) && msg.message.longitude && msg.message.latitude) {
        const time = msg.message.timestamp?.getTime();
        geometry.coordinates.push([
          msg.message.longitude,
          msg.message.latitude,
          msg.message.altitude ?? this.lastAltitude ?? 0,
          time ? time / 1000 : 0,
        ]);
      }
    }

    // Often, the first point has no altitude, but the next one has
    const [first, second, ...other] = geometry.coordinates;
    if (first?.[2] === 0 && second?.[2] !== 0) {
      first[2] = second![2]!;
      geometry.coordinates = [first, second!, ...other];
    }

    return geometry;
  }
}

const readFitFile = (blob: Uint8Array): LineString => new FIT().readFeatures(blob);

export { readFitFile };
