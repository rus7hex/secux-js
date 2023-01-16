/*!
Copyright 2023 SecuX Technology Inc
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


import { blake2bHex } from "blakejs";
import { ow_address } from "./interface";
import ow from "ow";


export function toSubstratePubkey(address: string): string {
    ow(address, ow_address);

    const message = `0x65766d3a${address.substring(2).toLowerCase()}`;
    return blake2b(message);
}

export function toAgencePubkey(address: string): string {
    ow(address, ow_address);

    const addr = address.substring(2).toLowerCase();
    const hashed = blake2b(`0x65766d3a${addr}`);

    return `0x${addr}${hashed.slice(-24)}`;
}

export function blake2b(message: string | Uint8Array, byteLength = 32): string {
    let data: string | Uint8Array = message;

    if (typeof message === "string" && message.startsWith("0x")) {
        data = Buffer.from(message.substring(2), "hex");
    }

    return `0x${blake2bHex(data, undefined, byteLength)}`;
}