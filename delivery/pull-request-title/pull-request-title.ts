import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import { CHANGE_TYPES, type ConventionalSubject, conventionalSubjectOf, type SubjectRejection } from "../commit-subject/conventional-subject.ts";

const USAGE = "usage: pull-request-title <title>\n";

const EXPECTED_FORM = `A pull request title is its squash commit's subject on main, so it must read type(scope)!: description, with an optional lowercase scope, ! only for a breaking change, and type one of ${CHANGE_TYPES.join(", ")}.`;

const rejectionText = (request: { readonly title: string; readonly rejection: SubjectRejection }): string => {
  switch (request.rejection.kind) {
    case "unshaped":
      return `pull request title ${JSON.stringify(request.title)} is not a conventional commit subject.`;
    case "unknown-type":
      return `pull request title ${JSON.stringify(request.title)} has the unknown type ${request.rejection.type}.`;
  }
};

const readingText = (request: { readonly subject: ConventionalSubject }): string =>
  `pull request title: ${request.subject.type}, ${request.subject.scope === undefined ? "no scope" : `${request.subject.scope} scope`}, ${request.subject.compatibility}`;

export const runPullRequestTitleCheck = (request: { readonly process: ProcessPort }): void => {
  const [title, ...unexpectedArguments] = request.process.arguments;
  if (title === undefined || unexpectedArguments.length > 0) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const subject = conventionalSubjectOf({ subject: title });
  if (subject.outcome === "failed") {
    request.process.writeError({ text: `${rejectionText({ title, rejection: subject.error })} ${EXPECTED_FORM}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeOut({ text: `${readingText({ subject: subject.value })}\n` });
  request.process.exitWith({ code: 0 });
};
