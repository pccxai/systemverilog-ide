// PCCX(TM) — reusable AI accelerator project.
// SPDX-FileCopyrightText: 2026 Hyun Woo Kim
// SPDX-License-Identifier: Apache-2.0

module bad_module (
    input  logic clk,
    output logic o_x
);

    always_ff @(posedge clk) begin
        o_x <= 1'b0;
    end

// endmodule intentionally omitted to exercise PCCX-SCAFFOLD-003
