import assert from "node:assert/strict";

import {
  PATCH_PROPOSAL_PREVIEW_VERSION,
  createPatchProposalPreview,
  findCheckedPatchProposalById,
  formatPatchProposalPreview,
  listCheckedPatchProposals,
} from "../src/patch-proposal-preview.mjs";

function unsafeProposal() {
  return {
    version: 1,
    proposalId: "unsafe",
    source: "local-prototype",
    title: "Unsafe proposal",
    summary: "Attempts to use a private path.",
    riskLevel: "high",
    files: [
      {
        path: "/home/dev/repo/rtl/top.sv",
        changeKind: "modify",
        reason: "Private absolute path.",
        hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, preview: "@@" }],
      },
    ],
    validationPlan: ["Review manually."],
    nonGoals: ["Do not apply automatically."],
    requiresUserReview: true,
  };
}

function testCheckedPreviewIsSummaryOnlyAndDoesNotApply() {
  const preview = createPatchProposalPreview("missingEndmodulePreview");

  assert.equal(preview.version, PATCH_PROPOSAL_PREVIEW_VERSION);
  assert.equal(preview.kind, "patch-proposal-preview");
  assert.equal(preview.proposalOnly, true);
  assert.equal(preview.appliesPatches, false);
  assert.equal(preview.writesFiles, false);
  assert.equal(preview.providerCalls, false);
  assert.equal(preview.runtimeCalls, false);
  assert.equal(preview.summary.proposalId, "missingEndmodulePreview");
  assert.equal(preview.summary.riskLevel, "low");
  assert.equal(preview.summary.fileCount, 1);
  assert.equal(preview.summary.hunkCount, 1);
  assert.equal(preview.summary.requiresUserReview, true);
  assert.match(preview.previewText, /Patch Proposal Preview/);
  assert.match(preview.previewText, /fixtures\/missing_endmodule\.sv/);
  assert.match(preview.previewText, /appliesPatches: no/);
  assert.doesNotMatch(JSON.stringify(preview), /\/home\/|TOKEN=|scripts\/private/);
}

function testCheckedProposalListingAndLookupValidateContract() {
  const proposals = listCheckedPatchProposals();
  const proposal = findCheckedPatchProposalById("missingEndmodulePreview");

  assert.ok(proposals.some((item) => item.proposalId === "missingEndmodulePreview"));
  assert.equal(proposal.proposalId, "missingEndmodulePreview");
  assert.equal(proposal.files[0].path, "fixtures/missing_endmodule.sv");
  assert.equal(findCheckedPatchProposalById("bash scripts/private.sh"), null);
}

function testPreviewRejectsRawProposalObjects() {
  assert.throws(
    () => createPatchProposalPreview({ proposal: unsafeProposal() }),
    /checked proposal IDs only/,
  );
}

function testPreviewRejectsUnsafeCheckedProposalData() {
  assert.throws(
    () => createPatchProposalPreview("unsafe", {
      checkedPatchProposals: [unsafeProposal()],
    }),
    /relative to the repository/,
  );
}

function testPreviewFormattingIsDeterministic() {
  const proposal = findCheckedPatchProposalById("missingEndmodulePreview");
  const first = formatPatchProposalPreview(proposal);
  const second = formatPatchProposalPreview(proposal);

  assert.equal(first, second);
  assert.match(first, /validationPlan:/);
  assert.match(first, /nonGoals:/);
}

testCheckedPreviewIsSummaryOnlyAndDoesNotApply();
testCheckedProposalListingAndLookupValidateContract();
testPreviewRejectsRawProposalObjects();
testPreviewRejectsUnsafeCheckedProposalData();
testPreviewFormattingIsDeterministic();

console.log("vscode patch proposal preview tests ok");
