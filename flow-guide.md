# Definitive Guide: Claude Code CLI via CI&T Flow

Connect Claude Code CLI to Anthropic and other LLM providers through the CI&T Flow LLM Proxy — your company's secure, authenticated gateway to AI models.

---

## Overview

The **Flow LLM Proxy** is a LiteLLM-based proxy server that sits between your local tools and LLM providers (OpenAI, Anthropic via AWS Bedrock, Google Gemini, DeepSeek, and others). It handles authentication through Flow's identity system so you don't need individual provider API keys — only a Flow JWT.

**Claude Code CLI** is Anthropic's terminal-based coding assistant. When pointed at the Flow proxy, it routes all requests through your company's infrastructure, with access controls and usage tracking built in.

---

## Prerequisites

- Node.js and npm installed locally
- A CI&T Flow account at [flow.ciandt.com](https://flow.ciandt.com)

---

## Step 1: Get Your API Credentials

You need three values from the Flow portal: `clientId`, `clientSecret`, and `tenant`.

1. Go to [flow.ciandt.com](https://flow.ciandt.com)
2. Click the **Avatar icon** (top-right corner)
3. Select **Settings**
4. Go to **API Keys**
5. Click **Create new key**
6. Give the key a name
7. Under **APPS**, select **llm-api**
8. Save the generated credentials securely — you will not be able to see the secret again

---

## Step 2: Generate a JWT Token

A JWT is the recommended authentication method for the Flow LLM Proxy. You can generate one manually via the browser or using a shell script.

### Option A — Manual via jwt.io

1. Open [jwt.io](https://jwt.io) in your browser
2. Select **JWT Encoder**
3. Set the **Headers** to:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

4. Set the **Payload** with your credentials:

```json
{
  "clientId": "<your-client-id>",
  "clientSecret": "<your-client-secret>",
  "tenant": "<your-tenant>"
}
```

5. Copy the generated token from the right-hand panel

### Option B — Shell Script

Download the `generate_jwt.sh` script from the Flow repository, then run:

```bash
chmod a+x scripts/generate_jwt.sh
./scripts/generate_jwt.sh
```

Copy the output token.

> **Note:** JWTs expire. Re-generate and update your config when requests start returning 401 errors.

---

## Step 3: Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

Official resources:
- [Documentation](https://docs.anthropic.com/claude-code)
- [Repository](https://github.com/anthropics/claude-code)

---

## Step 4: Configure `~/.claude/settings.json`

Edit (or create) the file at `~/.claude/settings.json` and add the following `env` block:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://flow.ciandt.com/flow-llm-proxy",
    "ANTHROPIC_AUTH_TOKEN": "your-flow-jwt-token",
    "ANTHROPIC_MODEL": "anthropic.claude-4-6-sonnet",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "anthropic.claude-4-5-haiku",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "anthropic.claude-4-6-sonnet",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "anthropic.claude-4-6-opus",
    "CLAUDE_CODE_SKIP_AUTH_LOGIN": "true",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Replace `<your-jwt-token>` with the JWT generated in Step 2.

You can change `ANTHROPIC_MODEL` and `ANTHROPIC_DEFAULT_HAIKU_MODEL` to any model from the supported list below.

---

## Step 5: Run

```bash
claude
```

Claude Code will start and route all requests through the Flow LLM Proxy.

---

## Reference: Models Supported in Claude Code CLI

These are the models confirmed to work with Claude Code CLI through Flow. Use the **exact model name** (left column) in your `settings.json`.

| Model | Alias |
|---|---|
| `anthropic.claude-37-sonnet` | `claude-37`, `claude-3.7-sonnet` |
| `anthropic.claude-4-sonnet` | `claude-4-sonnet`, `claude-4` |
| `anthropic.claude-4-5-sonnet` * | `claude-4-5-sonnet`, `claude-45`, `claude-4.5`, `claude-4-5` |
| `gpt-4.1` | `gpt41` |
| `o3-mini` | `o1-mini` |
| `o1` | — |
| `gpt-5` | `gpt5` |
| `gpt-5-mini` | `gpt5-mini` |
| `gpt-5-nano` | `gpt5-nano` |
| `grok-3` | `grok3` |

> \* `anthropic.claude-4-5-sonnet` may not work correctly in Claude Code CLI.

---

## Reference: All Available Models on Flow

The full model catalog available through the proxy (not all are supported by every client):

| Model | Alias |
|---|---|
| `gpt-4o` | `gpt-4` |
| `gpt-4o-mini` | `gpt4-mini` |
| `gpt-4.1` | `gpt41` |
| `o3-mini` | `o1-mini` |
| `o1` | — |
| `gpt-5` | `gpt5` |
| `gpt-5-mini` | `gpt5-mini` |
| `gpt-5-nano` | `gpt5-nano` |
| `gemini-2.5-flash` | `gemini-25-flash` |
| `gemini-2.0-flash` | `gemini-20-flash` |
| `gemini-2.5-pro` | `gemini-25-pro` |
| `anthropic.claude-37-sonnet` | `claude-37`, `claude-3.7-sonnet` |
| `anthropic.claude-4-sonnet` | `claude-4-sonnet`, `claude-4` |
| `anthropic.claude-4-5-sonnet` | `claude-4-5-sonnet`, `claude-45`, `claude-4.5`, `claude-4-5` |
| `meta.llama3-70b-instruct` | `meta.llama3` |
| `grok-3` | `grok3` |
| `deepseek-r1` *(no tools/agent support)* | `DeepSeek-R1` |

---

## Reference: Proxy Endpoints

| Environment | URL |
|---|---|
| Production | `https://flow.ciandt.com/flow-llm-proxy` |
| Development | `https://dev.flow.ciandt.com/flow-llm-proxy` |
| Swagger (reference only) | `https://litellm-api.up.railway.app` |

---

## Troubleshooting

**Requests fail with 401 Unauthorized**
- Your JWT has expired. Re-generate it following Step 2 and update `ANTHROPIC_AUTH_TOKEN` in `settings.json`.

**Model not found / proxy can't resolve the model**
- Use the exact model name from the table above. Aliases also work, but must be spelled exactly as listed. Incorrect names (e.g. `claude-4-sonnet` instead of `anthropic.claude-4-sonnet`) will fail.

**Requests reach Anthropic directly instead of Flow**
- Check that `ANTHROPIC_BASE_URL` is set to `https://flow.ciandt.com/flow-llm-proxy/` (with trailing slash).

**Claude Code doesn't pick up the settings**
- Confirm the file path is `~/.claude/settings.json` (not `.claude.json` or inside the project directory).
- Restart Claude Code after editing the file.

**Tool/agent features not working**
- DeepSeek-R1 does not support tools or agent mode. Switch to a Claude or GPT model.

**"adaptive thinking is not supported on this model" (Bedrock 400)**
- Claude Code v2.1+ sends `"type": "adaptive"` thinking parameters by default. The Flow proxy routes Anthropic models through AWS Bedrock, which only accepts `"enabled"` or `"disabled"` thinking types.
- Fix: add `CLAUDE_CODE_DISABLE_THINKING=1` to your `~/.claude/settings.json` env block:

```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_THINKING": "1"
  }
}
```

- This disables extended thinking entirely, which is safe — Flow/Bedrock does not support it anyway.

**Using non-Anthropic models (GPT, Gemini) with MCP tools**
- OpenAI's API strictly validates tool schemas. If an MCP server exposes a tool with a malformed schema (e.g. missing `properties` field), the entire request is rejected. Anthropic's API is more lenient.
- Fix: disable or remove the offending MCP server in `~/.claude.json` under `mcpServers`, or switch to an Anthropic model.

---

## Using GSD (Get Shit Done) with Flow

[GSD](https://github.com/gsd-framework/gsd) is a Claude Code-based coding agent. It reads its model configuration from the same `~/.claude/settings.json`, but **does not** pick up `env` variables defined there — it only inherits environment variables from your shell.

### Required: Export env vars in your shell profile

GSD only inherits environment variables from your shell — it does **not** read the `env` block in `~/.claude/settings.json`. Any `CLAUDE_CODE_*` variable that matters must be duplicated in your shell profile.

Add the following to your `~/.zshrc` (or `~/.bashrc`):

```bash
export CLAUDE_CODE_SKIP_AUTH_LOGIN=true
export CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

| Variable | Why it's needed |
|---|---|
| `CLAUDE_CODE_SKIP_AUTH_LOGIN` | Skips the Anthropic OAuth login prompt — authentication goes through Flow JWT instead |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | Prevents beta API features that the proxy may not support |
| `CLAUDE_CODE_DISABLE_THINKING` | Disables `"type": "adaptive"` thinking that Bedrock rejects with a 400 error |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enables agent teams feature in GSD |

Then reload your shell:

```bash
source ~/.zshrc
```

> **Why is this needed?** Claude Code CLI reads both `~/.claude/settings.json` env vars and shell environment variables. GSD only reads shell environment variables. Every `CLAUDE_CODE_*` variable must be set in both places to ensure all tools work correctly through the Flow proxy.
