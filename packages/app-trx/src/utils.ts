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
import { ow_transferData, ow_trc10_Data, ow_trc20_Data, transferData, trc10_Data, trc20_Data } from "./interface";


export function isTransfer(data: any): transferData | undefined {
    try {
        ow(data, ow_transferData);

        return data;
    }
    catch (e) { }
}

export function isTrc10Data(data: any): trc10_Data | undefined {
    try {
        ow(data, ow_trc10_Data);

        return data;
    }
    catch (e) { }
}

export function isTrc20Data(data: any): trc20_Data | undefined {
    try {
        ow(data, ow_trc20_Data);

        return data;
    }
    catch (e) { }
}
