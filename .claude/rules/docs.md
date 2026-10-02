Rule: give every tool both a `SKILL.md` for agents and a `README.md` for people
Reason: an agent about to run the tool and a person reading the repo need different documents, and the repos are public

Rule: put each fact in exactly one of the two files, choosing the SKILL when an agent would call the tool differently without it and the README otherwise
Reason: a fact written twice drifts, so the two files would disagree after the first change to either

Rule: follow the Agent Skills specification (agentskills.io/specification) for `SKILL.md`, opening it with YAML frontmatter holding `name` and `description`
Reason: the open standard lets any agent that supports skills load the tool on demand, reading only the name and description until a task needs the rest

Rule: set `name` to the tool's folder name, at most 64 lowercase letters, digits, and single hyphens, with no hyphen at either end
Reason: the specification requires the name to match the folder, and refuses any other form

Rule: write `description` as what the tool does and when to reach for it, with the words a task would use, in under 1024 characters
Reason: the description alone decides whether an agent loads the skill, so it has to name the situations the tool is for

Rule: write the SKILL body as `Rule:` and `Reason:` line pairs covering how to call the tool: commands, flags, defaults, what reaches stdout and stderr, setup steps, workflows, and prohibitions
Reason: the body is a how-to for an agent carrying out a task, and the line pairs keep each instruction and its cause together

Rule: keep `SKILL.md` under 500 lines, moving long reference material into files the SKILL names
Reason: the specification loads the whole SKILL when the skill activates, so length is paid on every use

Rule: do not explain in the SKILL how the tool works inside, beyond what changes how it is called
Reason: explanation belongs to the README, and an agent needs the call, not the mechanism

Rule: head a tool's README sections `What it does`, `Unsupported`, and `Common issues`, in that order
Reason: one shape across tools tells a reader where to look, matching the explanation a person needs rather than the steps an agent follows

Rule: describe in `What it does` what the tool is for, how it works, and the decisions behind it, without listing flags or usage steps
Reason: usage lives in the SKILL, and the README is for understanding the tool

Rule: list under `Unsupported` only behavior someone proposed and was declined, written as the behavior and why the tool does without it
Reason: an imagined boundary is a roadmap entry, and the decision itself belongs to the history

Rule: write each `Common issues` entry as the symptom in bold, then its cause, then the fix
Reason: a reader arrives from a symptom, so the entry has to start where they are

Rule: write the repo's root README as a short description, a table of the tools with one line each, how to run a tool, and the repo's structure
Reason: the root README is what a visitor sees first, and it points into each tool rather than repeating it

Rule: write every README and SKILL with one sentence per line, no em dashes, no emoji, and no comparison to another repo unless the placement depends on it
Reason: a sentence per line diffs cleanly, and the house style bars dashes and emoji everywhere
