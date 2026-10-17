import { useState } from "react";
import { CODE_ALPHABET, CODE_LENGTH } from "../../party/protocol";
import { cls } from "../ui";

export type PartyEntryProps = {
  savedName: string;
  invitedCode?: string;
  onCreate(name: string): void;
  onJoin(code: string, name: string): void;
};

const NOT_CODE = new RegExp(`[^${CODE_ALPHABET}]`, "g");

export function PartyEntry({ savedName, invitedCode, onCreate, onJoin, ready }: PartyEntryProps & { ready: boolean }) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(invitedCode ?? "");
  const trimmed = name.trim();
  const canJoin = ready && trimmed !== "" && code.length === CODE_LENGTH;

  return (
    <section className={cls("panel party-entry", invitedCode && "party-entry--invited")}>
      <h2 className="panel__title">{invitedCode ? `You're invited to party ${invitedCode}` : "Play with friends"}</h2>
      <form
        className="party-entry__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canJoin) onJoin(code, trimmed);
        }}
      >
        <label className="field">
          <span className="field__label">Your name</span>
          <input
            className="text-input"
            value={name}
            maxLength={20}
            placeholder="e.g. John"
            autoFocus={invitedCode !== undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {!invitedCode && (
          <>
            <button type="button" className="btn btn--secondary" disabled={!ready || trimmed === ""} onClick={() => onCreate(trimmed)}>
              Create party
            </button>
            <span className="party-entry__or">or join</span>
          </>
        )}
        <label className="field">
          <span className="field__label">Party code</span>
          <input
            className="text-input code-input"
            value={code}
            maxLength={CODE_LENGTH}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(NOT_CODE, ""))}
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!canJoin}>
          Join
        </button>
      </form>
    </section>
  );
}
