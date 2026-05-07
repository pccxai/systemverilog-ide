module bad_module (
    input  logic clk,
    output logic o_x
);

    always_ff @(posedge clk) begin
        o_x <= 1'b0;
    end

// endmodule intentionally omitted to exercise PCCX-SCAFFOLD-003
