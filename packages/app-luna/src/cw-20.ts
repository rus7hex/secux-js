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


import { MsgExecuteContract } from "./msg";
import { ow_address } from "./interface";
import { toUint128String } from "./proto";
import ow from "ow";


export namespace CW20 {
    export function transfer(contract: string, args: TransferArg) {
        ow(contract, ow_address);
        ow(args, ow_transfer);

        return new MsgExecuteContract(
            args.from,
            contract,
            {
                transfer: {
                    recipient: args.to,
                    amount: toUint128String(args.amount),
                }
            }
        );
    }

    export function transferFrom(contract: string, args: TransferArg) {
        ow(contract, ow_address);
        ow(args, ow_transfer);

        return new MsgExecuteContract(
            args.from,
            contract,
            {
                transfer_from: {
                    owner: args.from,
                    recipient: args.to,
                    amount: toUint128String(args.amount),
                }
            }
        );
    }
}


interface BaseArg {
    from: string,
    amount: string | number,
}
const _base = {
    from: ow_address,
    amount: ow.any(ow.string, ow.number),
}

interface TransferArg extends BaseArg {
    to: string,
}
const ow_transfer = ow.object.exactShape({
    ..._base,
    to: ow_address
});