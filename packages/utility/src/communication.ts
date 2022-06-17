/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import ow from "ow";
import { Logger } from "./utility";
const logger = Logger?.child({ id: "protocol" });


const SERVICE = (process.env.SECUX_PLATFROM === "service");
export const ONESIGN_THRESHOLD = 4000;
export const MAX_HEAD_SIZE = 25;


export const toCommunicationData = (!SERVICE) ?
    (data: Buffer) => data :
    (data: Buffer) => data.toString("base64");

export function wrapResult(data: any) {
    if (!SERVICE) return data;
    if (typeof data !== "object") return data;

    return JSON.stringify(data);
}

export function Send(cla: number, ins: number, p1: number = 0, p2: number = 0, data: Buffer = Buffer.alloc(0)): communicationData {
    const dataLengthBuffer = Buffer.alloc(2);
    dataLengthBuffer.writeUInt16LE(data.length, 0);

    const buf = Buffer.concat([
        Buffer.from([cla, ins, p1, p2]),
        dataLengthBuffer,
        data,
        Buffer.alloc(2), // response length, ignore
        Buffer.from([0x00, 0x00, 0x00, 0x00]) // delay, retry
    ]);
    logger?.debug(`send data: ${buf.toString("hex")}`);


    return toCommunicationData(buf);
}

export function toAPDUResponse(rsp: Buffer) {
    const dataLength = rsp.readUInt16LE(0);
    const status = rsp.readUInt16BE(2 + dataLength); // big endian

    // need to access more than dataLength + 6, since response padding for some zero
    if (dataLength + 6 > rsp.length) {
        logger?.warn(`Received data missing error: ${rsp.toString("hex")}`);
        throw Error(`Received data error: ${rsp.toString("hex")}`);
    }

    return {
        data: rsp.slice(2, 2 + dataLength),
        dataLength,
        status
    };
}

export function getBuffer(data: communicationData) {
    return (typeof data === "string") ? Buffer.from(data, "base64") : data;
}

const APDU_L1_PREFIX = Buffer.from([0xf8, 0x02, 0x00, 0x00]);
export function to_L1_APDU(data: communicationData): communicationData {
    const buf = getBuffer(data);
    const apdu_L1 = Buffer.concat([APDU_L1_PREFIX, buf]);

    return toCommunicationData(apdu_L1);
}

export class TransportStatusError extends Error {
    #name: string = "TransportStatusError";
    #message: string;
    #statusCode: number;
    #statusText: string;

    constructor(code: number) {
        super();

        if (code in StatusCode) {
            this.#statusText = StatusCode[code];
        }
        else {
            this.#statusText = "UNKNOWN_ERROR";
        }

        this.#statusCode = code;
        this.#message = `[SecuX device] ${this.#statusText} (0x${code.toString(16)})`;
    }

    get name() { return this.#name; }
    get message() { return this.#message; }
    get statusCode() { return this.#statusCode; }
    get statusText() { return this.#statusText; }
}


export type base64String = string;
export type communicationData = base64String | Buffer;
export const base64_regexp = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
export const ow_base64String = ow.string.matches(base64_regexp);
export const ow_communicationData = ow.any(
    ow_base64String,
    ow.buffer
);

export enum StatusCode {
    SUCCESS = 0x9000,
    USER_CANCEL = 0x9001,
    DATA_ERROR = 0x5001,
    CLA_ERROR = 0x5002,
    INS_ERROR = 0x5003
}
