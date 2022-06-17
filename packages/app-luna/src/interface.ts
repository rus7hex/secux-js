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


import { ow_strictPath } from "@secux/utility";
import { Any } from "@terra-money/terra.proto/google/protobuf/any";
import { bech32 } from "bech32";
import ow from "ow";
import { Coins } from "./coin";


export const ow_path = ow_strictPath(330, 44);

export const ow_address = ow.string.is(s => {
    if (!s.startsWith("terra")) return false;

    try {
        const { prefix } = bech32.decode(s);
        return prefix.startsWith("terra");
    } catch (error) {
        return false;
    }
});

const amount_object = ow.object.is((o: any) => {
    try {
        new Coins(o);
        return true;
    } catch (error) {
        return false;
    }
});
const amount_string = ow.string.is(s => {
    try {
        Coins.fromString(s);
        return true;
    } catch (error) {
        return false;
    }
});
export const ow_amount = ow.any(amount_object, amount_string);

export enum AddressType {
    account = "account",
    validator = "validator",
    pubkey = "pubkey"
}

export const ow_AddressType = ow.string.oneOf(Object.values(AddressType));

export type Signer = {
    accountNumber: number,
    sequence: number,
    path: string,
    publickey: string | Buffer,
};

export const ow_Signer = ow.object.partialShape({
    accountNumber: ow.number.uint32,
    sequence: ow.number.uint32,
    path: ow_path,
});

export type TxOption = {
    fee: Coins.Input,
    gasLimit: number,
    chainId?: string,
    payer?: string,
    granter?: string,
    memo?: string,
    timeoutHeight?: number,
};

export enum Network {
    Mainnet = "columbus-5",
    Testnet = "bombay-12",
}

export const ow_TxOption = ow.object.exactShape({
    fee: ow_amount,
    gasLimit: ow.number.positive,
    chainId: ow.optional.string.oneOf(Object.values(Network)),
    payer: ow.any(ow_address, ow.undefined),
    granter: ow.any(ow_address, ow.undefined),
    memo: ow.optional.string,
    timeoutHeight: ow.optional.number.not.negative,
});

export interface IMessage {
    toAmino(): any;
    toData(): any;
    toProto(): any;
    packAny(): Any;
}

export const ow_IMessage = ow.object.hasKeys(
    "toAmino",
    "toData",
    "toProto",
    "packAny",
);


export enum AminoType {
    MsgSend = "bank/MsgSend",
    MsgExecuteContract = "wasm/MsgExecuteContract",
    MsgDelegate = "staking/MsgDelegate",
    MsgWithdrawDelegatorReward = "distribution/MsgWithdrawDelegationReward",
    MsgUndelegate = "staking/MsgUndelegate",
    MsgBeginRedelegate = "staking/MsgBeginRedelegate",
}