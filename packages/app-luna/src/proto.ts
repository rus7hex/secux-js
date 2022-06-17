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


import { Any, DeepPartial } from "@terra-money/terra.proto/google/protobuf/any";
import { Reader, Writer } from "protobufjs/minimal";
import { BigNumber } from 'bignumber.js';


export abstract class IMsg {
    static fromAmino(data: any): IMsg { throw Error(NotImplemented); }
    static fromData(data: any): IMsg { throw Error(NotImplemented); }
    static fromProto(data: any): IMsg { throw Error(NotImplemented); }

    static unpackAny(data: Any): IMsg {
        return this.fromProto(this.protobuf.decode(data.value));
    }

    toAmino(): any { throw Error(NotImplemented); }
    toData(): any { throw Error(NotImplemented); }

    toProto(): any {
        //@ts-ignore
        const protobuf = this.constructor["protobuf"];
        return protobuf.fromPartial(this.partial);
    }

    packAny(): Any {
        const _: any = this.constructor;

        return Any.fromPartial({
            typeUrl: _.typeUrl,
            value: _.protobuf.encode(this.toProto()).finish(),
        });
    }

    get partial(): any { throw Error(NotImplemented); }

    static get protobuf(): IProtoBuf { return Any }
    static get typeUrl(): string { throw Error(NotImplemented); }
}

export interface IProtoBuf {
    encode(message: Any, writer?: Writer): Writer;
    decode(input: Reader | Uint8Array, length?: number | undefined): Any;
    fromJSON(object: any): Any;
    toJSON(message: Any): unknown;
    fromPartial(object: DeepPartial<Any>): Any;
}

const NotImplemented = "abstract method need to be implemented.";


export function removeNull(obj: any): any {
    if (obj !== null && typeof obj === 'object') {
        return Object.entries(obj)
            .filter(([, v]) => v != null)
            .reduce(
                (acc, [k, v]) => ({
                    ...acc,
                    [k]: v === Object(v) && !Array.isArray(v) ? removeNull(v) : v,
                }),
                {}
            );
    }

    return obj;
}

export function toUint128String(value: BigNumber.Value) {
    const a = new BigNumber(value);
    if (a.lt(0)) throw Error(`ArgumentError: expect non-negative number, but got ${value}`);
    if (!a.isInteger()) throw Error(`ArgumentError: expect value of uint128, but got ${value}`);
    if (a.gte(3.4028237e+38)) throw Error(`ArgumentError: value out of range, got ${value}`);

    return a.toFixed(0);
}