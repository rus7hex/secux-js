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
import { base64String, StatusCode } from "@secux/utility/lib/communication";


export enum EllipticCurve {
    SECP256K1,
    ED25519,
    ED25519_ADA,
    SCHNORR_BTC,
    ED25519_RAW,
    SECP256K1_LOW_R,
    __LENGTH
}
export const ow_EllipticCurve = ow.number.inRange(0, EllipticCurve.__LENGTH - 1);
export const ow_xpubCurve = ow.number.oneOf([EllipticCurve.SECP256K1, EllipticCurve.ED25519_ADA]);
export const ow_HardandedPath = ow.string.matches(/^m(\/\d+')+$/);

export enum TransactionType {
    NORMAL,
    TOKEN,
    NFT,
    __LENGTH
}
export const ow_TransactionType = ow.number.inRange(0, TransactionType.__LENGTH - 1);

export enum ShowOption {
    NONE,
    CONFIRM,
    MESSAGE,
    __LENGTH
}
export const ow_ShowOption = ow.number.inRange(0, ShowOption.__LENGTH - 1);

export type TransactionOption = {
    tp?: TransactionType,
    curve?: EllipticCurve,
    chainId?: number,
    // showOption: ShowOption,
    // balance?: string,
    // toAddress?: string,
    // message?: string
}

export const ow_TransactionOption = ow.object.exactShape({
    tp: ow.any(ow.undefined, ow_TransactionType),
    curve: ow.any(ow.undefined, ow_EllipticCurve),
    chainId: ow.optional.number.not.negative,
});

export interface IAPDUResponse {
    dataLength: number;
    data: base64String;
    status: StatusCode;
}
