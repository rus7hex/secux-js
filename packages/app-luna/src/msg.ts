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


import { Coin, Coins } from "./coin";
import { AminoType, ow_address } from "./interface";
import { IMsg, IProtoBuf, removeNull } from "./proto";
import ow from "ow";
import { owTool } from "@secux/utility";
export { MsgSend, MsgExecuteContract, MsgDelegate, MsgWithdrawDelegatorReward, MsgUndelegate, MsgBeginRedelegate };


class MsgSend extends IMsg {
    #from: string;
    #to: string;
    #amount: Coins;

    constructor(from: string, to: string, amount: Coins.Input) {
        super();
        ow(from, ow_address);
        ow(to, ow_address);
        ow(amount, ow.any(ow.string, ow.object));

        this.#from = from;
        this.#to = to;
        this.#amount = new Coins(amount);
    }

    static fromAmino(data: any): MsgSend {
        const {
            value: { from_address, to_address, amount },
        } = data;
        return new MsgSend(from_address, to_address, Coins.fromAmino(amount));
    }

    static fromData(data: any): MsgSend {
        const { from_address, to_address, amount } = data;
        return new MsgSend(from_address, to_address, Coins.fromData(amount));
    }

    static fromProto(data: any): MsgSend {
        return new MsgSend(
            data.fromAddress,
            data.toAddress,
            Coins.fromProto(data.amount)
        );
    }

    toAmino() {
        return {
            type: AminoType.MsgSend,
            value: {
                from_address: this.#from,
                to_address: this.#to,
                amount: this.#amount.toAmino(),
            },
        };
    }

    toData() {
        return {
            "@type": MsgSend.typeUrl,
            from_address: this.#from,
            to_address: this.#to,
            amount: this.#amount.toData(),
        };
    }

    get partial(): any {
        return {
            fromAddress: this.#from,
            toAddress: this.#to,
            amount: this.#amount.toProto(),
        };
    }

    static get protobuf(): IProtoBuf {
        return require("@terra-money/terra.proto/cosmos/bank/v1beta1/tx").MsgSend;
    }

    static get typeUrl(): string {
        return "/cosmos.bank.v1beta1.MsgSend";
    }
}

class MsgExecuteContract extends IMsg {
    #sender: string;
    #contract: string;
    #msg: string | object;
    #coins: Coins;

    constructor(sender: string, contract: string, execute_msg: string | object, coins: Coins.Input = {}) {
        super();
        ow(sender, ow_address);
        ow(contract, ow_address);
        ow(execute_msg, ow.any(ow.string, ow.object));
        ow(coins, ow.any(ow.string, ow.object));

        this.#sender = sender;
        this.#contract = contract;
        this.#msg = execute_msg;
        this.#coins = new Coins(coins);
    }

    static fromAmino(data: any): MsgExecuteContract {
        const {
            value: { sender, contract, execute_msg, coins },
        } = data;
        return new MsgExecuteContract(
            sender,
            contract,
            execute_msg,
            Coins.fromAmino(coins)
        );
    }

    static fromData(data: any): MsgExecuteContract {
        const { sender, contract, execute_msg, coins } = data;
        return new MsgExecuteContract(
            sender,
            contract,
            execute_msg,
            Coins.fromData(coins)
        );
    }

    static fromProto(data: any): MsgExecuteContract {
        const { sender, contract, executeMsg, coins } = data;
        return new MsgExecuteContract(
            sender,
            contract,
            JSON.parse(Buffer.from(executeMsg).toString()),
            Coins.fromProto(coins)
        );
    }

    toAmino() {
        return {
            type: AminoType.MsgExecuteContract,
            value: {
                sender: this.#sender,
                contract: this.#contract,
                execute_msg: removeNull(this.#msg),
                coins: this.#coins.toAmino(),
            },
        };
    }

    toData() {
        return {
            "@type": MsgExecuteContract.typeUrl,
            sender: this.#sender,
            contract: this.#contract,
            execute_msg: this.#msg,
            coins: this.#coins.toData(),
        };
    }

    get partial(): any {
        return {
            sender: this.#sender,
            contract: this.#contract,
            executeMsg: Buffer.from(JSON.stringify(removeNull(this.#msg))),
            coins: this.#coins.toProto(),
        };
    }

    static get protobuf(): IProtoBuf {
        return require("@terra-money/terra.proto/terra/wasm/v1beta1/tx").MsgExecuteContract;
    }

    static get typeUrl(): string {
        return "/terra.wasm.v1beta1.MsgExecuteContract";
    }
}

class MsgDelegate extends IMsg {
    #delegator: string;
    #validator: string;
    #amount: Coin;

    constructor(delegator: string, validator: string, amount: string | number) {
        super();
        ow(delegator, ow_address);
        ow(validator, ow_address);
        ow(amount, ow.any(owTool.numberString, ow.number));

        this.#delegator = delegator;
        this.#validator = validator;
        this.#amount = new Coin("uluna", amount);
    }

    static fromAmino(data: any): MsgDelegate {
        const {
            value: { delegator_address, validator_address, amount },
        } = data;
        return new MsgDelegate(
            delegator_address,
            validator_address,
            Coin.fromAmino(amount).amount
        );
    }

    static fromData(data: any): MsgDelegate {
        const { delegator_address, validator_address, amount } = data;
        return new MsgDelegate(
            delegator_address,
            validator_address,
            Coin.fromData(amount).amount
        );
    }

    static fromProto(data: any): MsgDelegate {
        const { delegatorAddress, validatorAddress, amount } = data;
        return new MsgDelegate(
            delegatorAddress,
            validatorAddress,
            Coin.fromProto(amount).amount
        );
    }

    toAmino() {
        return {
            type: AminoType.MsgDelegate,
            value: {
                delegator_address: this.#delegator,
                validator_address: this.#validator,
                amount: this.#amount.toAmino(),
            },
        };
    }

    toData() {
        return {
            "@type": MsgDelegate.typeUrl,
            delegator_address: this.#delegator,
            validator_address: this.#validator,
            amount: this.#amount.toData(),
        };
    }

    get partial(): any {
        return {
            delegatorAddress: this.#delegator,
            validatorAddress: this.#validator,
            amount: this.#amount.toProto(),
        };
    }

    static get protobuf(): IProtoBuf {
        return require("@terra-money/terra.proto/cosmos/staking/v1beta1/tx").MsgDelegate;
    }

    static get typeUrl(): string {
        return "/cosmos.staking.v1beta1.MsgDelegate";
    }
}

class MsgWithdrawDelegatorReward extends IMsg {
    #delegator: string;
    #validator: string;

    constructor(delegator: string, validator: string) {
        super();
        ow(delegator, ow_address);
        ow(validator, ow_address);

        this.#delegator = delegator;
        this.#validator = validator;
    }

    static fromAmino(data: any): MsgWithdrawDelegatorReward {
        const {
            value: { delegator_address, validator_address },
        } = data;
        return new MsgWithdrawDelegatorReward(delegator_address, validator_address);
    }

    static fromData(data: any): MsgWithdrawDelegatorReward {
        const { delegator_address, validator_address } = data;
        return new MsgWithdrawDelegatorReward(delegator_address, validator_address);
    }

    static fromProto(data: any): MsgWithdrawDelegatorReward {
        const { delegatorAddress, validatorAddress } = data;
        return new MsgWithdrawDelegatorReward(delegatorAddress, validatorAddress);
    }

    toAmino() {
        return {
            type: AminoType.MsgWithdrawDelegatorReward,
            value: {
                delegator_address: this.#delegator,
                validator_address: this.#validator,
            },
        };
    }

    toData() {
        return {
            "@type": MsgWithdrawDelegatorReward.typeUrl,
            delegator_address: this.#delegator,
            validator_address: this.#validator,
        };
    }

    get partial(): any {
        return {
            delegatorAddress: this.#delegator,
            validatorAddress: this.#validator,
        };
    }

    static get protobuf(): IProtoBuf {
        return require("@terra-money/terra.proto/cosmos/distribution/v1beta1/tx").MsgWithdrawDelegatorReward;
    }

    static get typeUrl(): string {
        return "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward";
    }
}

class MsgUndelegate extends IMsg {
    #delegator: string;
    #validator: string;
    #amount: Coin;

    constructor(delegator: string, validator: string, amount: string | number) {
        super();
        ow(delegator, ow_address);
        ow(validator, ow_address);
        ow(amount, ow.any(owTool.numberString, ow.number));

        this.#delegator = delegator;
        this.#validator = validator;
        this.#amount = new Coin("uluna", amount);
    }

    static fromAmino(data: any): MsgUndelegate {
        const {
            value: { delegator_address, validator_address, amount },
        } = data;
        return new MsgUndelegate(
            delegator_address,
            validator_address,
            Coin.fromAmino(amount).amount
        );
    }

    static fromData(data: any): MsgUndelegate {
        const { delegator_address, validator_address, amount } = data;
        return new MsgUndelegate(
            delegator_address,
            validator_address,
            Coin.fromData(amount).amount
        );
    }

    static fromProto(data: any): MsgUndelegate {
        const { delegatorAddress, validatorAddress, amount } = data;
        return new MsgUndelegate(
            delegatorAddress,
            validatorAddress,
            Coin.fromProto(amount).amount
        );
    }

    toAmino() {
        return {
            type: AminoType.MsgUndelegate,
            value: {
                delegator_address: this.#delegator,
                validator_address: this.#validator,
                amount: this.#amount.toAmino(),
            },
        };
    }

    toData() {
        return {
            "@type": MsgUndelegate.typeUrl,
            delegator_address: this.#delegator,
            validator_address: this.#validator,
            amount: this.#amount.toData(),
        };
    }

    get partial(): any {
        return {
            delegatorAddress: this.#delegator,
            validatorAddress: this.#validator,
            amount: this.#amount.toProto(),
        };
    }

    static get protobuf(): IProtoBuf {
        return require("@terra-money/terra.proto/cosmos/staking/v1beta1/tx").MsgUndelegate;
    }

    static get typeUrl(): string {
        return "/cosmos.staking.v1beta1.MsgUndelegate";
    }
}

class MsgBeginRedelegate extends IMsg {
    #delegator: string;
    #validator: string;
    #validator_new: string;
    #amount: Coin;

    constructor(delegator: string, validator_src: string, validator_dst: string, amount: string | number) {
        super();
        ow(delegator, ow_address);
        ow(validator_src, ow_address);
        ow(validator_dst, ow_address);
        ow(amount, ow.any(owTool.numberString, ow.number));

        this.#delegator = delegator;
        this.#validator = validator_src;
        this.#validator_new = validator_dst;
        this.#amount = new Coin("uluna", amount);
    }

    static fromAmino(data: any): MsgBeginRedelegate {
        const {
            value: {
                delegator_address,
                validator_src_address,
                validator_dst_address,
                amount,
            },
        } = data;
        return new MsgBeginRedelegate(
            delegator_address,
            validator_src_address,
            validator_dst_address,
            Coin.fromAmino(amount).amount
        );
    }

    static fromData(data: any): MsgBeginRedelegate {
        const {
            delegator_address,
            validator_src_address,
            validator_dst_address,
            amount,
        } = data;
        return new MsgBeginRedelegate(
            delegator_address,
            validator_src_address,
            validator_dst_address,
            Coin.fromData(amount).amount
        );
    }

    static fromProto(data: any): MsgBeginRedelegate {
        const {
            delegatorAddress,
            validatorSrcAddress,
            validatorDstAddress,
            amount,
        } = data;
        return new MsgBeginRedelegate(
            delegatorAddress,
            validatorSrcAddress,
            validatorDstAddress,
            Coin.fromProto(amount).amount
        );
    }

    toAmino() {
        return {
            type: AminoType.MsgBeginRedelegate,
            value: {
                delegator_address: this.#delegator,
                validator_src_address: this.#validator,
                validator_dst_address: this.#validator_new,
                amount: this.#amount.toAmino(),
            },
        };
    }

    toData() {
        return {
            "@type": MsgBeginRedelegate.typeUrl,
            delegator_address: this.#delegator,
            validator_src_address: this.#validator,
            validator_dst_address: this.#validator_new,
            amount: this.#amount.toData(),
        };
    }

    get partial(): any {
        return {
            delegatorAddress: this.#delegator,
            validatorSrcAddress: this.#validator,
            validatorDstAddress: this.#validator_new,
            amount: this.#amount.toProto(),
        };
    }

    static get protobuf(): IProtoBuf {
        return require("@terra-money/terra.proto/cosmos/staking/v1beta1/tx").MsgBeginRedelegate;
    }

    static get typeUrl(): string {
        return "/cosmos.staking.v1beta1.MsgBeginRedelegate";
    }
}


export namespace Msg {
    export function fromAmino(data: any): IMsg {
        const type = data.type;
        const m = map[type];

        if (!m) throw Error(`ArgumentError: unsupport message type, got "${type}"`);

        return m.fromAmino(data);
    }

    export function fromData(data: any): IMsg {
        const type = data["@type"];
        const m = map[type];

        if (!m) throw Error(`ArgumentError: unsupport message type, got "${type}"`);

        return m.fromData(data);
    }

    export function fromProto(data: any): IMsg {
        const type = data.typeUrl;
        const m = map[type];

        if (!m) throw Error(`ArgumentError: unsupport message type, got "${type}"`);

        return m.unpackAny(data);
    }
}

const map: { [name: string]: typeof IMsg } = {};
for (const m of Object.values(exports) as any) {
    if (!!m.typeUrl) {
        //@ts-ignore
        map[AminoType[m.name]] = m;
        map[m.typeUrl] = m;
    }
}
