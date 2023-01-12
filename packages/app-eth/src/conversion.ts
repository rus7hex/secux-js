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