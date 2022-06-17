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


import { MemoType } from 'stellar-base';
import ow from "ow";
import { owTool } from '@secux/utility';

export const ow_bip32Path = ow.string.matches(/^m\/44'\/148'\/\d+'$/);
export const ow_address = ow.string.matches(/^G[0-9A-Za-z]+$/);

export type memoObj = {
    Type: MemoType,
    Value: string
}

export const ow_memoObj = ow.object.exactShape({
    Type: ow.string.oneOf(["none", "id", "text", "hash", "return"]),
    Value: ow.string
});

export type txDetail = {
    from?: string,
    to: string,
    amount: string,
    sequence: string | number,
    fee: string | number,
    memo?: memoObj,
    networkPassphrase?: string,
    needCreateAccount?: boolean
};

export const ow_txDetail = ow.object.exactShape({
    from: ow_address,
    to: ow_address,
    amount: ow.string.matches(/^\d*.?\d*$/),
    sequence: ow.any(owTool.numberString, ow.number.positive),
    fee: ow.any(owTool.numberString, ow.number.positive),
    memo: ow.any(ow.undefined, ow_memoObj),
    networkPassphrase: ow.optional.string,
    needCreateAccount: ow.optional.boolean
});
