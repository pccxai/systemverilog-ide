import assert from "node:assert/strict";

import {
  PATCH_PROPOSAL_CHANGE_KINDS,
  PATCH_PROPOSAL_CONTRACT_VERSION,
  PATCH_PROPOSAL_RISK_LEVELS,
  PATCH_PROPOSAL_SCHEMA_VERSION,
  PATCH_PROPOSAL_SOURCE,
  createPatchProposalContractStatus,
  normalizePatchProposal,
  validatePatchProposal,
} from "../src/patch-proposal-contract.mjs";

function safeProposal(overrides = {}) {
  return {
    version: PATCH_PROPOSAL_SCHEMA_VERSION,
    proposalId: "missingEndmoduleFix",
    source: PATCH_PROPOSAL_SOURCE,
    title: "Add missing endmodule",
    summary: "Proposes a small SystemVerilog syntax fix for review.",
    riskLevel: "low",
    files: [
      {
        path: "fixtures/missing_endmodule.sv",
        changeKind: "modify",
        reason: "The checked fixture is missing a closing declaration.",
        hunks: [
          {
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
            preview: "@@\n module missing_endmodule;\n+endmodule",
          },
        ],
      },
    ],
    validationPlan: [
      "Run the VS Code adapter smoke through the approved validation proposal.",
      "Run the repository test baseline through the approved validation proposal.",
    ],
    nonGoals: [
      "Do not apply the patch automatically.",
      "Do not add runtime provider calls.",
    ],
    requiresUserReview: true,
    ...overrides,
  };
}

function assertInvalid(proposal, pattern) {
  const result = validatePatchProposal(proposal);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
  assert.throws(() => normalizePatchProposal(proposal), pattern);
}

function testSafePatchProposalNormalizesDeterministically() {
  const proposal = normalizePatchProposal(safeProposal());

  assert.equal(proposal.version, 1);
  assert.equal(proposal.proposalId, "missingEndmoduleFix");
  assert.equal(proposal.source, "local-prototype");
  assert.equal(proposal.riskLevel, "low");
  assert.equal(proposal.requiresUserReview, true);
  assert.equal(proposal.files.length, 1);
  assert.equal(proposal.files[0].path, "fixtures/missing_endmodule.sv");
  assert.equal(proposal.files[0].changeKind, "modify");
  assert.equal(proposal.files[0].hunks.length, 1);
  assert.equal(proposal.files[0].hunks[0].oldStart, 1);
  assert.equal(proposal.validationPlan.length, 2);
  assert.equal(proposal.nonGoals.length, 2);
  assert.doesNotMatch(JSON.stringify(proposal), /\/home\/|TOKEN=|scripts\/private/);
}

function testContractStatusIsProposalOnly() {
  const status = createPatchProposalContractStatus();

  assert.equal(status.version, PATCH_PROPOSAL_CONTRACT_VERSION);
  assert.equal(status.schemaVersion, PATCH_PROPOSAL_SCHEMA_VERSION);
  assert.equal(status.source, PATCH_PROPOSAL_SOURCE);
  assert.equal(status.proposalOnly, true);
  assert.equal(status.appliesPatches, false);
  assert.equal(status.writesFiles, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.requiresUserReview, true);
  assert.deepEqual(status.allowedChangeKinds, PATCH_PROPOSAL_CHANGE_KINDS);
  assert.deepEqual(status.allowedRiskLevels, PATCH_PROPOSAL_RISK_LEVELS);
  assert.ok(status.disallowedActions.includes("applyPatch"));
  assert.ok(status.disallowedActions.includes("executeCommand"));
  assert.ok(status.disallowedActions.includes("accessSecrets"));
}

function testRejectsUnsafePathsAndArtifacts() {
  assertInvalid(
    safeProposal({
      files: [
        {
          path: "/home/dev/repo/rtl/top.sv",
          changeKind: "modify",
          reason: "Absolute path.",
          hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, preview: "@@" }],
        },
      ],
    }),
    /relative to the repository/,
  );
  assertInvalid(
    safeProposal({
      files: [
        {
          path: "node_modules/pkg/generated.js",
          changeKind: "modify",
          reason: "Generated dependency path.",
          hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, preview: "@@" }],
        },
      ],
    }),
    /private, generated, secret-like, or binary artifact paths/,
  );
  assertInvalid(
    safeProposal({
      files: [
        {
          path: "models/local.safetensors",
          changeKind: "add",
          reason: "Model artifact.",
          hunks: [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: 1, preview: "@@" }],
        },
      ],
    }),
    /private, generated, secret-like, or binary artifact paths/,
  );
}

function testRejectsSecretsShellCommandsAndAutoApplyShape() {
  assertInvalid(
    safeProposal({ summary: "TOKEN=hidden" }),
    /secret-like assignments/,
  );
  assertInvalid(
    safeProposal({ validationPlan: ["python3 -m pytest -q"] }),
    /shell commands/,
  );
  assertInvalid(
    safeProposal({ requiresUserReview: false }),
    /requiresUserReview: must be true/,
  );
  assertInvalid(
    {
      ...safeProposal(),
      autoApply: true,
    },
    /autoApply: is not allowed/,
  );
}

function testRejectsBulkPreviewAndUnknownNestedKeys() {
  const bulkPreview = Array.from({ length: 45 }, (_, index) => `line ${index}`).join("\n");

  assertInvalid(
    safeProposal({
      files: [
        {
          path: "rtl/top.sv",
          changeKind: "modify",
          reason: "Too much preview text.",
          hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, preview: bulkPreview }],
        },
      ],
    }),
    /at most 40 line/,
  );
  assertInvalid(
    safeProposal({
      files: [
        {
          path: "rtl/top.sv",
          changeKind: "modify",
          reason: "Unknown key.",
          command: "bash scripts/private.sh",
          hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, preview: "@@" }],
        },
      ],
    }),
    /files\[0\]\.command: is not allowed/,
  );
}

testSafePatchProposalNormalizesDeterministically();
testContractStatusIsProposalOnly();
testRejectsUnsafePathsAndArtifacts();
testRejectsSecretsShellCommandsAndAutoApplyShape();
testRejectsBulkPreviewAndUnknownNestedKeys();

console.log("vscode patch proposal contract tests ok");
