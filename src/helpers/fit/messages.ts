import { getMessageName, getFieldObject, Message } from './fit';

export function getFitMessage(messageNum: number): { name: string; getAttributes: (fiedldNum: number) => Message } {
  return {
    name: getMessageName(messageNum),
    getAttributes: (fieldNum: number) => getFieldObject(fieldNum, messageNum),
  };
}

// TODO
export function getFitMessageBaseType(foo: number): number {
  return foo;
}
