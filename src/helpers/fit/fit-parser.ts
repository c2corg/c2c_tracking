/* eslint-disable @typescript-eslint/no-non-null-assertion */

import Binary, { FieldDefinition } from './binary';

export type Options = {
  lengthUnit: 'm' | 'km' | 'mi';
  temperatureUnit: 'celsius' | 'kelvin' | 'fahrenheit';
  speedUnit: 'm/s' | 'km/h' | 'mph';
  elapsedRecordField: boolean;
};

export type ActivityFields =
  | 'sessions'
  | 'events'
  | 'hrv'
  | 'device_infos'
  | 'developer_data_ids'
  | 'field_descriptions'
  | 'sports'
  | 'laps'
  | 'records'
  | 'dive_gases'
  | 'course_points'
  | 'monitors'
  | 'stress'
  | 'definitions'
  | 'file_ids'
  | 'monitor_info'
  | 'lengths';

export type FitObj = {
  protocolVersion?: number;
  profileVersion?: number;
  software?: Record<string, unknown>;
  activity: {
    [key in ActivityFields]?: Record<string, unknown>[];
  };
  other: {
    [key: string]: Record<string, unknown>;
  };
};

export default class FitParser {
  private options: Options;
  private binary: Binary;

  constructor({ lengthUnit, temperatureUnit, speedUnit, elapsedRecordField }: Partial<Options> = {}) {
    this.options = {
      speedUnit: speedUnit || 'm/s',
      lengthUnit: lengthUnit || 'm',
      temperatureUnit: temperatureUnit || 'celsius',
      elapsedRecordField: elapsedRecordField || false,
    };
    this.binary = new Binary();
  }

  parse(blob: Uint8Array): FitObj {
    this.binary = new Binary();

    if (blob.length < 12) {
      throw new Error('File to small to be a FIT file');
    }

    const headerLength = blob[0];
    if (headerLength !== 14 && headerLength !== 12) {
      throw new Error('Incorrect header size');
    }

    let fileTypeString = '';
    for (let i = 8; i < 12; i++) {
      fileTypeString += String.fromCharCode(blob[i]!);
    }
    if (fileTypeString !== '.FIT') {
      throw new Error("Missing '.FIT' in header");
    }

    if (headerLength === 14) {
      const crcHeader = blob[12]! + (blob[13]! << 8);
      const crcHeaderCalc = this.binary.calculateCRC(blob, 0, 12);
      if (crcHeader !== crcHeaderCalc) {
        throw new Error('Header CRC mismatch');
      }
    }

    const protocolVersion = blob[1]!;
    const profileVersion = blob[2]! + (blob[3]! << 8);
    const dataLength = blob[4]! + (blob[5]! << 8) + (blob[6]! << 16) + (blob[7]! << 24);
    const crcStart = dataLength + headerLength;
    const crcFile = blob[crcStart]! + (blob[crcStart + 1]! << 8);
    const crcFileCalc = this.binary.calculateCRC(blob, headerLength === 12 ? 0 : headerLength, crcStart);

    if (crcFile !== crcFileCalc) {
      throw new Error('File CRC mismatch');
    }

    const fitObj: FitObj = {
      protocolVersion,
      profileVersion,
      activity: {},
      other: {},
    };

    const sessions: Record<string, unknown>[] = [];
    const laps: Record<string, unknown>[] = [];
    const records: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const hrv: Record<string, unknown>[] = [];
    const devices: Record<string, unknown>[] = [];
    const applications: Record<string, unknown>[] = [];
    const fieldDescriptions: Record<string, unknown>[] = [];
    const dive_gases: Record<string, unknown>[] = [];
    const course_points: Record<string, unknown>[] = [];
    const sports: Record<string, unknown>[] = [];
    const monitors: Record<string, unknown>[] = [];
    const stress: Record<string, unknown>[] = [];
    const definitions: Record<string, unknown>[] = [];
    const file_ids: Record<string, unknown>[] = [];
    const monitor_info: Record<string, unknown>[] = [];
    const lengths: Record<string, unknown>[] = [];

    let loopIndex = headerLength;

    let startDate = 0;
    let lastStopTimestamp = 0;
    let pausedTime = 0;

    const messageTypes: {
      littleEndian: boolean;
      globalMessageNumber: number;
      numberOfFields: number;
      fieldDefs: FieldDefinition[];
    }[] = [];
    const developerFields: Record<string, unknown>[][] = [];

    while (loopIndex < crcStart) {
      const { nextIndex, messageType, message } = this.binary.readRecord(
        blob,
        messageTypes,
        developerFields,
        loopIndex,
        this.options,
        startDate,
        pausedTime,
      );
      loopIndex = nextIndex;

      switch (messageType) {
        case 'lap':
          laps.push(message!);
          break;
        case 'session':
          sessions.push(message!);
          break;
        case 'event':
          if (message!['event'] === 'timer') {
            if (message!['event_type'] === 'stop_all') {
              lastStopTimestamp = message!['timestamp'] as number;
            } else if (message!['event_type'] === 'start' && lastStopTimestamp) {
              pausedTime += ((message!['timestamp'] as number) - lastStopTimestamp) / 1000;
            }
          }
          events.push(message!);
          break;
        case 'length':
          lengths.push(message!);
          break;
        case 'hrv':
          hrv.push(message!);
          break;
        case 'record':
          if (!startDate) {
            startDate = message!['timestamp'] as number;
            message!['elapsed_time'] = 0;
            message!['timer_time'] = 0;
          }
          records.push(message!);
          break;
        case 'field_description':
          fieldDescriptions.push(message!);
          break;
        case 'device_info':
          devices.push(message!);
          break;
        case 'developer_data_id':
          applications.push(message!);
          break;
        case 'dive_gas':
          dive_gases.push(message!);
          break;
        case 'course_point':
          course_points.push(message!);
          break;
        case 'sport':
          sports.push(message!);
          break;
        case 'file_id':
          if (message) {
            file_ids.push(message);
          }
          break;
        case 'definition':
          if (message) {
            definitions.push(message);
          }
          break;
        case 'monitoring':
          monitors.push(message!);
          break;
        case 'monitoring_info':
          monitor_info.push(message!);
          break;
        case 'stress_level':
          stress.push(message!);
          break;
        case 'software':
          fitObj['software'] = message!;
          break;
        default:
          if (messageType !== '') {
            fitObj['other'][messageType] = message!;
          }
          break;
      }
    }

    fitObj['activity'] = fitObj['activity'] || {};
    fitObj['activity'].sessions = sessions;
    fitObj['activity'].events = events;
    fitObj['activity'].hrv = hrv;
    fitObj['activity'].device_infos = devices;
    fitObj['activity'].developer_data_ids = applications;
    fitObj['activity'].field_descriptions = fieldDescriptions;
    fitObj['activity'].sports = sports;
    fitObj['activity'].laps = laps;
    fitObj['activity'].records = records;
    fitObj['activity'].dive_gases = dive_gases;
    fitObj['activity'].course_points = course_points;
    fitObj['activity'].monitors = monitors;
    fitObj['activity'].stress = stress;
    fitObj['activity'].definitions = definitions;
    fitObj['activity'].file_ids = file_ids;
    fitObj['activity'].monitor_info = monitor_info;
    fitObj['activity'].lengths = lengths;

    return fitObj;
  }
}
