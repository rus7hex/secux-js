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


import { owTool } from '@secux/utility';
import ow from 'ow';


export const ow_address = ow.string.matches(/^bnb1[0-9a-z]+$/);

export type txDetail = {
    publickey?: string | Buffer,
    to: string,
    amount: number,
    chainId?: string,
    accountNumber?: number,
    sequence?: number,
    memo?: string
};

export const ow_txDetail = ow.object.exactShape({
    publickey: ow.any(owTool.hexString, ow.buffer),
    to: ow_address,
    amount: ow.number.positive,
    chainId: ow.optional.string.nonEmpty,
    accountNumber: ow.optional.number.not.negative,
    sequence: ow.optional.number.not.negative,
    memo: ow.any(ow.undefined, ow.string.empty, ow.string.maxLength(100).numeric)
});
