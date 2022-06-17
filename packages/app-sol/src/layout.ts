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


import * as BufferLayout from "@solana/buffer-layout";


const publicKeyLayout = (property: string = 'publicKey') => BufferLayout.blob(32, property);

const stringLayout = (property: string = 'string') => {
    const rsl = BufferLayout.struct<any>(
        [
            BufferLayout.u32('length'),
            BufferLayout.u32('lengthPadding'),
            BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars'),
        ],
        property,
    );
    const _decode = rsl.decode.bind(rsl);
    const _encode = rsl.encode.bind(rsl);

    rsl.decode = (buffer: any, offset: any) => {
        const data = _decode(buffer, offset);
        return data['chars'].toString('utf8');
    };

    rsl.encode = (str: any, buffer: any, offset: any) => {
        const data = {
            chars: Buffer.from(str, 'utf8'),
        };
        return _encode(data, buffer, offset);
    };

    (rsl as any).alloc = (str: any) => {
        return (
            BufferLayout.u32().span +
            BufferLayout.u32().span +
            Buffer.from(str, 'utf8').length
        );
    };

    return rsl;
};


export type InstructionData = {
    programIdIndex: number,
    keyIndicesCount: Buffer,
    keyIndices: Buffer,
    dataLength: Buffer,
    data: Buffer
};

export const instructionLayout = (instruction: InstructionData) => BufferLayout.struct<any>([
    BufferLayout.u8('programIdIndex'),

    BufferLayout.blob(
        instruction.keyIndicesCount.length,
        'keyIndicesCount',
    ),

    BufferLayout.seq(
        BufferLayout.u8('keyIndex'),
        instruction.keyIndices.length,
        'keyIndices',
    ),

    BufferLayout.blob(
        instruction.dataLength.length,
        'dataLength'
    ),

    BufferLayout.seq(
        BufferLayout.u8('userdatum'),
        instruction.data.length,
        'data',
    ),
]);

export type signData = {
    numRequiredSignatures: Buffer,
    numReadonlySignedAccounts: Buffer,
    numReadonlyUnsignedAccounts: Buffer,
    keyCount: Buffer,
    keys: Array<Buffer>,
    recentBlockhash: Buffer
}

export const signDataLayout = (data: signData) => BufferLayout.struct<any>([
    BufferLayout.blob(1, 'numRequiredSignatures'),
    BufferLayout.blob(1, 'numReadonlySignedAccounts'),
    BufferLayout.blob(1, 'numReadonlyUnsignedAccounts'),
    BufferLayout.blob(data.keyCount.length, 'keyCount'),
    BufferLayout.seq(publicKeyLayout('key'), data.keys.length, 'keys'),
    publicKeyLayout('recentBlockhash'),
]);

export const createLayout = BufferLayout.struct<any>([
    BufferLayout.u32('instruction'),
    BufferLayout.ns64('lamports'),
    BufferLayout.ns64('space'),
    publicKeyLayout('programId')
]);

export const transferLayout = BufferLayout.struct<any>([
    BufferLayout.u32('instruction'),
    BufferLayout.ns64('lamports')
]);

export const createWithSeedLayout = BufferLayout.struct<any>([
    BufferLayout.u32('instruction'),
    publicKeyLayout('base'),
    stringLayout('seed'),
    BufferLayout.ns64('lamports'),
    BufferLayout.ns64('space'),
    publicKeyLayout('programId')
]);


export function getAlloc(layout: BufferLayout.Structure<any>, fields: any): number {
    let alloc = 0;
    layout.fields.forEach((item: any) => {
        if (item.span >= 0) {
            alloc += item.span;
        } else if (typeof item.alloc === 'function') {
            alloc += item.alloc(fields[item.property]);
        }
    });

    return alloc;
}
