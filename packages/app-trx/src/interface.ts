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
import { owTool } from "@secux/utility";


export const ow_address = ow.string.startsWith("T");

export type txDetail = transferData | trc10_Data | trc20_Data;

interface baseData {
    from?: string,
    blockID: string,
    blockNumber: number,
    expiration?: number,
    feeLimit?: number,
    timestamp: number
}

const ow_baseData = {
    from: ow_address,
    blockID: owTool.hexString,
    blockNumber: ow.number.positive,
    expiration: ow.optional.number.positive,
    feeLimit: ow.optional.number.positive,
    timestamp: ow.number.positive
};

export interface transferData extends baseData {
    to: string,
    amount: number | string
};

const amount = ow.any(ow.number.uint32.positive, owTool.numberString);
export const ow_transferData = ow.object.exactShape({
    ...ow_baseData,
    to: ow_address,
    amount
});

export interface trc10_Data extends baseData {
    token: string | number,
    to: string,
    amount: number | string
};

export const ow_trc10_Data = ow.object.exactShape({
    ...ow_baseData,
    token: ow.any(ow.string.matches(/\d+/), ow.number.uint32),
    to: ow_address,
    amount
});

export interface trc20_Data extends baseData {
    contract: string,
    to?: string,
    amount?: number | string,
    data?: string,
    tokenId?: number,
    tokenValue?: number,
    callValue?: number
};

export const ow_trc20_Data = ow.object.exactShape({
    ...ow_baseData,
    contract: ow_address,
    to: ow.any(ow.undefined, ow_address),
    amount: ow.any(ow.undefined, amount),
    data: ow.any(ow.undefined, owTool.hexString),
    tokenId: ow.optional.number,
    tokenValue: ow.optional.number.not.negative,
    callValue: ow.optional.number.not.negative
});
