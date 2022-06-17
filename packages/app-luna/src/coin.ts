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


import { BigNumber } from 'bignumber.js';
import { IMsg } from './proto';


export namespace Coin {
    export type Amino = {
        denom: string,
        amount: string,
    };

    export type Data = Amino;

    export type Proto = {
        denom: string,
        amount: any,
    };
}

const DEC_PRECISION = 18;
export class Coin extends IMsg {
    #denom: string;
    #amount: BigNumber;
    isDecimal: boolean = false;

    constructor(denom: string, amount: BigNumber.Value) {
        super();
        this.#denom = denom;
        this.#amount = new BigNumber(amount);
    }

    static fromString(str: string): Coin {
        const m = str.match(/^(-?[0-9]+(\.[0-9]+)?)([0-9a-zA-Z/]+)$/);
        if (m === null) {
            throw new Error(`failed to parse to Coin: ${str}`);
        }
        const amount = m[1];
        const denom = m[3];

        return new Coin(denom, amount);
    }

    static fromAmino(data: Coin.Amino): Coin {
        return new Coin(data.denom, data.amount);
    }

    static fromData(data: Coin.Data): Coin {
        return new Coin(data.denom, data.amount);
    }

    static fromProto(data: Coin.Proto): Coin {
        return new Coin(data.denom, parseAmount(data.amount));
    }

    toString(): string {
        const { denom, amount } = this.toData();
        if (amount.indexOf('.') === -1) {
            return `${amount}.0${denom}`;
        }

        return `${amount}${denom}`;
    }

    toAmino(): Coin.Amino {
        return {
            denom: this.#denom,
            amount: this.amount,
        }
    }

    toData(): Coin.Data {
        return {
            denom: this.#denom,
            amount: this.amount,
        }
    }

    get partial(): any {
        return {
            denom: this.#denom,
            amount: this.amount,
        }
    }

    get denom(): string { return this.#denom; }
    get amount(): string {
        if (this.isDecimal && !this.#amount.isInteger()) {
            return this.#amount.toFixed(DEC_PRECISION);
        }

        return this.#amount.toFixed();
    }

    static get protobuf(): any {
        return require("@terra-money/terra.proto/cosmos/base/v1beta1/coin").Coin;
    }
}

function parseAmount(value: any) {
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof BigNumber) {
        return value.toFixed();
    }

    return new BigNumber(value.toString()).toFixed();
}

export namespace Coins {
    export type Input = Coins.Dict | Array<Coin> | Coins | Coin | string;
    export type Amino = Array<Coin.Amino>;
    export type Data = Array<Coin.Data>;
    export type Proto = Array<Coin.Proto>;
    export type Dict = {
        [denom: string]: string;
    }
}

export class Coins extends IMsg implements Iterable<Coin.Data>{
    #coins: { [denom: string]: Coin };

    // implement iterator interface for interop
    [Symbol.iterator]() {
        let index = -1;
        const data = this.toArray();

        return {
            next: () => ({
                value: data[++index],
                done: (index === data.length) as true,
            }),
        };
    }

    constructor(arg: Coins.Input) {
        super();
        if (arg instanceof Coins) {
            this.#coins = { ...arg.#coins };
        }
        else if (arg instanceof Coin) {
            this.#coins = {};
            this.#coins[arg.denom] = arg;
        }
        else if (typeof arg === "string") {
            this.#coins = Coins.fromString(arg).#coins;
        }
        else {
            this.#coins = {};

            let coins: Coin[];
            if (!Array.isArray(arg)) {
                coins = [];
                Object.keys(arg).forEach(x => coins.push(new Coin(x, arg[x])));
            }
            else {
                coins = arg;
            }

            for (const coin of coins) {
                const { denom, amount } = coin;
                const x = this.#coins[denom];
                if (x === undefined) {
                    this.#coins[denom] = coin;
                }
                else {
                    const a = new BigNumber(amount);
                    const c = new Coin(denom, a.plus(x.amount).toFixed());
                    this.#coins[denom] = c;
                }
            }
        }
    }

    static fromString(str: string): Coins {
        const splits = str.split(/,\s*/);
        const coins = splits.map(s => Coin.fromString(s));

        return new Coins(coins);
    }

    static fromAmino(data?: Coins.Amino): Coins {
        return new Coins((data ?? []).map(Coin.fromAmino));
    }

    static fromData(data?: Coins.Data): Coins {
        return new Coins((data ?? []).map(Coin.fromData));
    }

    static fromProto(data?: Coins.Proto): Coins {
        return new Coins((data ?? []).map(Coin.fromProto));
    }

    toAmino(): Coins.Amino {
        return this.toArray().map(c => c.toAmino());
    }

    toData(): Coins.Data {
        return this.toArray().map(c => c.toData());
    }

    toProto(): Coins.Proto {
        return this.toArray().map(c => c.toProto());
    }

    toString() {
        return this.toArray()
            .map(c => c.toString())
            .join(',');
    }

    toArray(): Array<Coin> {
        return Object.values(this.#coins).sort((a, b) =>
            a.denom.localeCompare(b.denom)
        );
    }

    get isDecimal(): boolean {
        return Object.values(this.#coins)[0]?.isDecimal ?? false;
    }

    set isDecimal(value: boolean) {
        Object.values(this.#coins).forEach(c => c.isDecimal = value);
    }
}