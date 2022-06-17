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


export const ow_AccountPath = ow.string.matches(/^m(\/\d+'){3}/);

export type VersionInfo = {
    transportVersion: number
    seFwVersion: string,
    mcuFwVersion: string,
    bootloaderVersion: string
}

export enum WalletStatus {
    NORMAL = 34,
    HIDDEN = 98
}

export type WalletInfo = {
    walletIndex: number,
    walletName: string,
    walletStatus: WalletStatus
}

export enum SEMode {
    NORMAL = 2,
    HIDDEN = 3,
    INIT = 7
}

export type SEINFO = {
    mode: SEMode,
    state: number
}

export type AddressOption = {
    needToConfirm?: boolean,
    chainId?: number
}

export const ow_AddressOption = ow.object.exactShape({
    needToConfirm: ow.optional.boolean,
    chainId: ow.optional.number.inRange(0, 0xffff)
});

export type StatusCallback = (status: number) => void;

export type AccountInfo = {
    name: string,
    path: string,
    chainId: number | 0,
    balance: string,
    contract?: string,
    decimal?: number
}

const ow_accountName = ow.string.matches(/^[a-zA-Z0-9._-]+(\s+[a-zA-Z0-9._-]+)*$/).maxLength(16);

export const ow_AccountNormal = ow.object.exactShape({
    name: ow_accountName,
    path: ow_AccountPath,
    chainId: ow.optional.number.not.negative,
    balance: ow.string,
});

export const ow_AccountToken = ow.object.exactShape({
    name: ow_accountName,
    path: ow_AccountPath,
    chainId: ow.optional.number.not.negative,
    balance: ow.string,
    contract: owTool.hashString,
    decimal: ow.number
});

export type DeleteOption = {
    contract?: string,
    chainId: number
};

export const ow_DeleteOption = ow.object.exactShape({
    contract: ow.any(ow.undefined, owTool.hashString),
    chainId: ow.number.not.negative
});