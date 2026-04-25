/**
 * Remote Questions — Slack adapter
 */
import { formatForSlack, parseSlackReply, parseSlackReactionResponse, SLACK_NUMBER_REACTION_NAMES } from "./format.js";
import { apiRequest } from "./http-client.js";
const SLACK_API = "https://slack.com/api";
const SLACK_ACK_REACTION = "white_check_mark";
export class SlackAdapter {
    name = "slack";
    botUserId = null;
    token;
    channelId;
    constructor(token, channelId) {
        this.token = token;
        this.channelId = channelId;
    }
    async validate() {
        const res = await this.slackApi("auth.test", {});
        if (!res.ok)
            throw new Error(`Slack auth failed: ${res.error ?? "invalid token"}`);
        this.botUserId = String(res.user_id ?? "");
    }
    async sendPrompt(prompt) {
        const res = await this.slackApi("chat.postMessage", {
            channel: this.channelId,
            text: "GSD needs your input",
            blocks: formatForSlack(prompt),
        });
        if (!res.ok)
            throw new Error(`Slack postMessage failed: ${res.error ?? "unknown"}`);
        const ts = String(res.ts);
        const channel = String(res.channel);
        if (prompt.questions.length === 1) {
            const reactionNames = SLACK_NUMBER_REACTION_NAMES.slice(0, prompt.questions[0].options.length);
            for (const name of reactionNames) {
                try {
                    await this.slackApi("reactions.add", { channel, timestamp: ts, name });
                }
                catch {
                    // Best-effort only
                }
            }
        }
        return {
            ref: {
                id: prompt.id,
                channel: "slack",
                messageId: ts,
                threadTs: ts,
                channelId: channel,
                threadUrl: `https://slack.com/archives/${channel}/p${ts.replace(".", "")}`,
            },
        };
    }
    async pollAnswer(prompt, ref) {
        if (!this.botUserId)
            await this.validate();
        if (prompt.questions.length === 1) {
            const reactionAnswer = await this.checkReactions(prompt, ref);
            if (reactionAnswer)
                return reactionAnswer;
        }
        const res = await this.slackApi("conversations.replies", {
            channel: ref.channelId,
            ts: ref.threadTs,
            limit: "20",
        });
        if (!res.ok)
            return null;
        const messages = (res.messages ?? []);
        const userReplies = messages.filter((m) => m.ts !== ref.threadTs && m.user && m.user !== this.botUserId && m.text);
        if (userReplies.length === 0)
            return null;
        return parseSlackReply(String(userReplies[0].text), prompt.questions);
    }
    async acknowledgeAnswer(ref) {
        try {
            await this.slackApi("reactions.add", {
                channel: ref.channelId,
                timestamp: ref.messageId,
                name: SLACK_ACK_REACTION,
            });
        }
        catch {
            // Best-effort only
        }
    }
    async checkReactions(prompt, ref) {
        const res = await this.slackApi("reactions.get", {
            channel: ref.channelId,
            timestamp: ref.messageId,
            full: "true",
        });
        if (!res.ok)
            return null;
        const message = (res.message ?? {});
        const reactions = Array.isArray(message.reactions) ? message.reactions : [];
        const picked = reactions
            .filter((reaction) => reaction.name && SLACK_NUMBER_REACTION_NAMES.includes(reaction.name))
            .filter((reaction) => {
            const count = Number(reaction.count ?? 0);
            const users = Array.isArray(reaction.users) ? reaction.users.map(String) : [];
            const botIncluded = this.botUserId ? users.includes(this.botUserId) : false;
            return count > (botIncluded ? 1 : 0);
        })
            .map((reaction) => String(reaction.name));
        if (picked.length === 0)
            return null;
        return parseSlackReactionResponse(picked, prompt.questions);
    }
    async slackApi(method, params) {
        const isGet = method === "conversations.replies" || method === "auth.test" || method === "reactions.get";
        const opts = { authScheme: "Bearer", authToken: this.token, errorLabel: "Slack API" };
        if (isGet) {
            const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString();
            return apiRequest(`${SLACK_API}/${method}?${qs}`, "GET", undefined, opts);
        }
        return apiRequest(`${SLACK_API}/${method}`, "POST", params, {
            ...opts,
            contentType: "application/json; charset=utf-8",
        });
    }
}
