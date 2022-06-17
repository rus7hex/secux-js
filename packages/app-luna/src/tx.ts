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


const secp256k1 = require("secp256k1/elliptic");
import * as Long from "long";
import { sha256 } from "hash.js";
import { SignMode, signModeFromJSON, signModeToJSON } from "@terra-money/terra.proto/cosmos/tx/signing/v1beta1/signing";
import { SecuxTransactionTool } from "@secux/protocol-transaction";
import { communicationData, getBuffer, MAX_HEAD_SIZE, ONESIGN_THRESHOLD, toCommunicationData } from "@secux/utility/lib/communication";
import { Coins } from "./coin";
import { IMessage, Network, Signer, TxOption } from "./interface";
import { IMsg } from "./proto";
import { Msg } from "./msg";
export { Fee };


export namespace Transaction {
    export function create(signers: Array<Signer>, messages: Array<IMessage>, fee: Fee, option?: TxOption)
        : { commands: Array<communicationData>, serialized: communicationData } {
        const signerInfo = signers.map(s => {
            const info = new SignerInfo(
                new PublicKey(s.publickey!),
                s.sequence,
                new ModeInfo(new ModeInfo.Single(SignMode.SIGN_MODE_LEGACY_AMINO_JSON))
            );
            info.path = s.path;
            info.accountNumber = s.accountNumber;

            return info;
        });

        const tx = new Tx(
            new TxBody(messages, option?.memo, option?.timeoutHeight),
            new AuthInfo(signerInfo, fee),
            option?.chainId ?? Network.Mainnet
        );

        const obj = {
            serialized: tx.toBytes().toString("base64"),
            accounts: tx.signers.map(x => x.accountNumber ?? 0),
        }

        return {
            commands: tx.prepareSign(),
            serialized: toCommunicationData(Buffer.from(JSON.stringify(obj))),
        }
    }

    export function finalize(serialized: communicationData, signatures: Array<string>): string {
        const obj = JSON.parse(getBuffer(serialized).toString());
        const tx = Tx.fromBuffer(Buffer.from(obj.serialized, "base64"));
        for (let i = 0; i < tx.signers.length; i++) {
            tx.signers[i].accountNumber = obj.accounts[i];
        }
        tx.appendSignature(signatures);

        return tx.toBytes().toString("base64");
    }

    export function simulate(signers: Array<Signer>, messages: Array<IMessage>, option?: TxOption): string {
        const signerInfo = signers.map(s => {
            const info = new SignerInfo(
                new PublicKey(s.publickey ?? ''),
                s.sequence,
                new ModeInfo(new ModeInfo.Single(SignMode.SIGN_MODE_LEGACY_AMINO_JSON))
            );
            info.path = s.path;
            info.accountNumber = s.accountNumber;

            return info;
        });

        const tx = new Tx(
            new TxBody(messages, option?.memo, option?.timeoutHeight),
            new AuthInfo(signerInfo, new Fee(0, {})),
            option?.chainId ?? Network.Mainnet
        );

        return tx.simulate();
    }
}

class Tx extends IMsg {
    #body: TxBody;
    #auth: AuthInfo;
    #signers: Array<SignerInfo>;
    #signatures: Array<string> = [];
    chainId: string;


    constructor(body: TxBody, auth_info: AuthInfo, chainId: string) {
        super();
        this.#body = body;
        this.#auth = auth_info;
        this.#signers = auth_info.signers;
        this.chainId = chainId;
    }

    static fromAmino(data: any): Tx {
        const { value: { msg, memo, signatures, timeout_height, fee } } = data;
        const sigList = (signatures as any[]).map(s => s.signature);

        const tx = new Tx(
            new TxBody(
                (msg as any[]).map(m => Msg.fromAmino(m)),
                memo,
                Number.parseInt(timeout_height)
            ),
            new AuthInfo([], Fee.fromAmino(fee)),
            Network.Mainnet
        );
        tx.#signatures = sigList;

        return tx;
    }

    static fromData(data: any): Tx {
        const { body, auth_info, signatures } = data;
        const tx = new Tx(
            TxBody.fromData(body),
            AuthInfo.fromData(auth_info),
            Network.Mainnet
        );
        tx.#signatures = signatures;

        return tx;
    }

    static fromProto(data: any): Tx {
        const { body, authInfo, signatures } = data;
        const tx = new Tx(
            TxBody.fromProto(body),
            AuthInfo.fromProto(authInfo),
            Network.Mainnet
        );
        tx.#signatures = (signatures as any[]).map(sig => Buffer.from(sig).toString("base64"));

        return tx;
    }

    static fromBuffer(data: Buffer): Tx {
        return Tx.fromProto(Tx.protobuf.decode(data));
    }

    prepareSign(): Array<communicationData> {
        const txs = this.#signers.map(x => ({ data: this.#dataForSignAmino(x), path: x.path! }));
        if (txs.some(tx => tx.data.length + MAX_HEAD_SIZE > ONESIGN_THRESHOLD)) {
            return txs.map(tx => {
                const hash = Buffer.from(sha256().update(tx.data).digest());
                return SecuxTransactionTool.signTransaction(tx.path, hash);
            });
        }

        let txList: Array<Buffer> = [];
        let pathList: Array<string> = [];
        let size = 0;
        const commands: Array<communicationData> = [];
        for (const tx of txs) {
            size += tx.data.length + MAX_HEAD_SIZE;
            pathList.push(tx.path);
            txList.push(tx.data);
            if (size < ONESIGN_THRESHOLD) continue;

            pathList.pop();
            txList.pop();
            commands.push(
                SecuxTransactionTool.signRawTransactionList(pathList, txList)
            );

            size = tx.data.length + MAX_HEAD_SIZE;
            pathList = [tx.path];
            txList = [tx.data];
        }

        if (txList.length > 0) {
            commands.push(
                SecuxTransactionTool.signRawTransactionList(pathList, txList)
            );
        }

        return commands;
    }

    appendSignature(signature: string | Array<string>) {
        let idx = this.#signatures.length;
        const sigList = (Array.isArray(signature)) ? signature : [signature];
        for (const sig of sigList) {
            const signer = this.#signers[idx++];
            const data = this.#dataForSignAmino(signer);
            const hash = Buffer.from(sha256().update(data).digest());
            if (!secp256k1.ecdsaVerify(Buffer.from(sig, "base64"), hash, signer.publickey)) {
                throw Error(`Signature Error #${idx}`);
            }
        }

        this.#signatures.push(...sigList);
    }

    simulate(): string {
        this.#signatures.length = 0;
        this.#signers.forEach(x => this.#signatures.push(''));
        const tx = this.toBytes().toString("base64");

        this.#signatures.length = 0;
        return tx;
    }

    toData() {
        return {
            body: this.#body.toData(),
            auth_info: this.#auth.toData(),
            signatures: this.#signatures,
        };
    }

    toBytes(): Buffer {
        return Buffer.from(
            Tx.protobuf.encode(this.toProto()).finish()
        );
    }

    get signers() { return this.#signers; }

    get partial(): any {
        return {
            body: this.#body.toProto(),
            authInfo: this.#auth.toProto(),
            signatures: this.#signatures.map(s => Buffer.from(s, "base64")),
        };
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").Tx;
    }

    #dataForSignAmino(signer: SignerInfo) {
        const doc = new SignDoc(
            this.#body,
            new AuthInfo([], this.#auth.fee),
            this.chainId,
            signer.accountNumber!,
            signer.sequence
        );
        return Buffer.from(doc.toAminoJson());
    }

    #dataForSign(signer: SignerInfo) {
        const doc = new SignDoc(
            this.#body,
            new AuthInfo([], this.#auth.fee),
            this.chainId,
            signer.accountNumber!,
            signer.sequence
        );
        return Buffer.from(doc.toBytes());
    }
}

class SignDoc extends IMsg {
    #body: TxBody;
    #auth: AuthInfo;
    #chainId: string;
    #accountNumber: number;
    #sequence: number;

    constructor(body: TxBody, auth: AuthInfo, chainId: string, accountNumber: number, sequence: number) {
        super();
        this.#body = body;
        this.#auth = auth;
        this.#chainId = chainId;
        this.#accountNumber = accountNumber;
        this.#sequence = sequence;
    }

    toAmino() {
        return {
            chain_id: this.#chainId,
            account_number: this.#accountNumber.toString(),
            sequence: this.#sequence.toString(),
            timeout_height: this.#body.timeoutHeight,
            fee: this.#auth.fee.toAmino(),
            msgs: this.#body.messages.map(m => m.toAmino()),
            memo: this.#body.memo ?? '',
        };
    }

    toData() {
        return {
            body_bytes: Buffer.from(this.#body.toBytes()).toString("base64"),
            auth_info_bytes: Buffer.from(this.#auth.toBytes()).toString("base64"),
            account_number: this.#accountNumber.toFixed(),
            chain_id: this.#chainId,
        };
    }

    toUnSignedTx() {
        return new Tx(this.#body, this.#auth, this.#chainId);
    }

    toBytes(): Uint8Array {
        return TxBody.protobuf.encode(this.toProto()).finish();
    }

    toAminoJson() {
        return JSON.stringify(prepareSignBytes(this.toAmino()));
    }

    get partial(): any {
        return {
            bodyBytes: this.#body.toBytes(),
            authInfoBytes: this.#auth.toBytes(),
            accountNumber: Long.fromNumber(this.#accountNumber),
            chainId: this.#chainId,
        };
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").SignDoc;
    }
}

function prepareSignBytes(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(prepareSignBytes);
    }

    if (typeof obj !== `object` || obj === null) {
        return obj;
    }

    const sorted: any = {};
    Object.keys(obj)
        .sort()
        .forEach(key => {
            if (obj[key] === undefined || obj[key] === null) return;
            sorted[key] = prepareSignBytes(obj[key]);
        });

    return sorted;
}

class TxBody extends IMsg {
    #timeoutBlock?: number;

    constructor(public messages: Array<IMessage>, public memo?: string, timeout_height?: number) {
        super();
        this.#timeoutBlock = timeout_height;
    }

    static fromData(data: any): TxBody {
        const { messages, memo, timeout_height } = data;
        return new TxBody(
            (messages as any[]).map(m => Msg.fromData(m)),
            memo,
            Number.parseInt(timeout_height)
        );
    }

    static fromProto(data: any): TxBody {
        const { messages, memo, timeoutHeight } = data;
        return new TxBody(
            (messages as any[]).map(m => Msg.fromProto(m)),
            memo,
            timeoutHeight.toNumber()
        );
    }

    toData() {
        return {
            messages: this.messages.map(m => m.toData()),
            memo: this.memo ?? '',
            timeout_height: (this.#timeoutBlock ?? 0).toFixed(),
        };
    }

    toBytes(): Uint8Array {
        return TxBody.protobuf.encode(this.toProto()).finish();
    }

    get partial(): any {
        return {
            messages: this.messages.map(m => m.packAny()),
            memo: this.memo,
            timeoutHeight: Long.fromNumber(this.#timeoutBlock ?? 0),
        };
    }

    get timeoutHeight(): string | undefined {
        if (this.#timeoutBlock && this.#timeoutBlock !== 0) {
            return this.#timeoutBlock.toString();
        }

        return undefined;
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").TxBody;
    }
}

class Fee extends IMsg {
    #amount: Coins;
    #gasLimit: number;
    #granter?: string;
    #payer?: string;

    constructor(gasLimit: number, amount: Coins.Input, payer?: string, granter?: string) {
        super();
        this.#amount = new Coins(amount);
        this.#amount.isDecimal = true;
        this.#gasLimit = Math.floor(gasLimit);
        this.#granter = granter;
        this.#payer = payer;
    }

    static fromAmino(data: any): Fee {
        const { gas, amount } = data;
        return new Fee(Number.parseInt(gas), Coins.fromAmino(amount), '', '');
    }

    static fromData(data: any): Fee {
        return new Fee(
            Number.parseInt(data.gas_limit),
            Coins.fromData(data.amount),
            data.payer,
            data.granter
        );
    }

    static fromProto(data: any): Fee {
        return new Fee(
            data.gasLimit.toNumber(),
            Coins.fromProto(data.amount),
            data.payer,
            data.granter
        );
    }

    toAmino() {
        return {
            gas: this.#gasLimit.toFixed(),
            amount: this.#amount.toAmino(),
        };
    }

    toData() {
        return {
            amount: this.#amount.toData(),
            gas_limit: this.#gasLimit.toFixed(),
            granter: this.#granter ?? '',
            payer: this.#payer ?? '',
        };
    }

    get partial(): any {
        return {
            amount: this.#amount.toProto(),
            gasLimit: Long.fromNumber(this.#gasLimit),
            granter: this.#granter,
            payer: this.#payer,
        };
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").Fee;
    }
}

class PublicKey extends IMsg {
    #key: string;

    constructor(secp256k1Key: string | Buffer) {
        super();
        this.#key = (typeof secp256k1Key === "string") ? secp256k1Key
            : secp256k1Key.toString("base64");
    }

    static fromAmino(data: any): PublicKey {
        return new PublicKey(data.value);
    }

    static fromData(data: any): PublicKey {
        return new PublicKey(data.key);
    }

    static fromProto(data: any): PublicKey {
        return new PublicKey(Buffer.from(data.key));
    }

    toAmino() {
        return {
            type: "tendermint/PubKeySecp256k1",
            value: this.#key,
        };
    }

    toData() {
        return {
            "@type": this.constructor.prototype.typeUrl,
            key: this.#key,
        };
    }

    get partial(): any {
        return {
            key: Buffer.from(this.#key, "base64"),
        };
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/crypto/secp256k1/keys").PubKey;
    }

    static get typeUrl(): string {
        return "/cosmos.crypto.secp256k1.PubKey";
    }
}


class AuthInfo extends IMsg {
    #signers: Array<SignerInfo>;

    constructor(signers: Array<SignerInfo>, public fee: Fee) {
        super();
        this.#signers = signers;
    }

    static fromData(data: any): AuthInfo {
        return new AuthInfo(
            (data.signer_infos as any[]).map(x => SignerInfo.fromData(x)),
            Fee.fromData(data.fee)
        );
    }

    static fromProto(data: any): AuthInfo {
        return new AuthInfo(
            (data.signerInfos as any[]).map(x => SignerInfo.fromProto(x)),
            Fee.fromProto(data.fee)
        );
    }

    toData() {
        return {
            fee: this.fee.toData(),
            signer_infos: this.#signers.map(x => x.toData()),
        };
    }

    toBytes(): Uint8Array {
        return AuthInfo.protobuf.encode(this.toProto()).finish();
    }

    get partial(): any {
        return {
            fee: this.fee.toProto(),
            signerInfos: this.#signers.map(x => x.toProto()),
        };
    }

    get signers() {
        return [...this.#signers];
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").AuthInfo;
    }
}

class SignerInfo extends IMsg {
    path?: string;
    accountNumber?: number;
    #publickey: IMsg;
    #sequence: number;
    #mode: ModeInfo;

    constructor(publickey: IMsg, sequence: number, mode: ModeInfo) {
        super();
        this.#publickey = publickey;
        this.#sequence = sequence;
        this.#mode = mode;
    }

    static fromData(data: any): SignerInfo {
        return new SignerInfo(
            PublicKey.fromData(data.public_key ?? new PublicKey('').toData()),
            Number.parseInt(data.sequence),
            ModeInfo.fromData(data.mode_info)
        );
    }

    static fromProto(data: any): SignerInfo {
        return new SignerInfo(
            PublicKey.unpackAny(data.publicKey ?? new PublicKey('').packAny()),
            data.sequence.toNumber(),
            ModeInfo.fromProto(data.modeInfo)
        );
    }

    toData() {
        return {
            mode_info: this.#mode.toData(),
            public_key: this.#publickey.toData(),
            sequence: this.#sequence.toFixed(),
        };
    }

    get partial(): any {
        return {
            modeInfo: this.#mode.toProto(),
            publicKey: this.#publickey.packAny(),
            sequence: Long.fromNumber(this.#sequence),
        };
    }

    get publickey(): Buffer {
        const { key } = this.#publickey.toData();
        return Buffer.from(key, "base64");
    }

    get sequence() { return this.#sequence; }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").SignerInfo;
    }
}

class ModeInfo extends IMsg {
    #single: ModeInfo.Single;

    constructor(info: ModeInfo.Single) {
        super();
        this.#single = info;
    }

    static fromData(data: any): ModeInfo {
        if (data.single) {
            return new ModeInfo(ModeInfo.Single.fromData(data.single));
        }

        throw Error('ArgumentError: unsupport sign mode');
    }

    static fromProto(data: any): ModeInfo {
        if (data.single) {
            return new ModeInfo(ModeInfo.Single.fromProto(data.single));
        }

        throw Error('ArgumentError: unsupport sign mode');
    }

    toData() {
        return {
            single: this.#single.toData(),
        }
    }

    get partial(): any {
        return {
            single: this.#single.toProto(),
        }
    }

    static get protobuf() {
        return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").ModeInfo;
    }
}

namespace ModeInfo {
    export class Single extends IMsg {
        #mode: SignMode;

        constructor(mode: SignMode) {
            super();
            this.#mode = mode;
        }

        static fromData(data: any): Single {
            return new Single(signModeFromJSON(data.mode));
        }

        static fromProto(data: any): Single {
            return new Single(data.mode);
        }

        toData() {
            return {
                mode: signModeToJSON(this.#mode)
            };
        }

        get partial(): any {
            return {
                mode: this.#mode,
            };
        }

        static get protobuf() {
            return require("@terra-money/terra.proto/cosmos/tx/v1beta1/tx").ModeInfo_Single;
        }
    }
}
