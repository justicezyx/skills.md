---
name: 1point3acres-login
description: >-
  Log into 1point3acres (1P3A) Interview / forum in Cursor Browser using email
  + password + email verification code from Gmail MCP. Use when the user asks to
  sign into 1point3acres, 1P3A, 一亩三分地, unlock member interview threads, or
  when Google Sign-In fails in Cursor Browser.
---

# 1point3acres login (Cursor Browser)

Google OAuth in Cursor Browser often breaks (`postMessage` on `null` in GSI). Prefer **username/password → 邮箱验证码登录** and read the code via **Gmail MCP**.

**Never store passwords or OTP codes in this skill or in git.** Ask the user for the password in chat when needed; pull codes from Gmail at runtime.

## Prerequisites

- Gmail MCP authenticated for the account that receives 1P3A mail (e.g. `justicezyx@gmail.com`)
- Cursor Browser (lock while automating)
- Forum email + password (user-supplied). Forum username may differ from email (e.g. greeting in OTP mail)

## Flow (working path)

### 1. Open classic auth (skip Google)

1. Navigate to `https://www.1point3acres.com/interview`
2. Click **Login / Sign up**
3. Click **Use Username + Password / Wechat instead**  
   → lands on `https://auth.1point3acres.com/login?url=https://www.1point3acres.com/interview`  
   (or go there directly)

Do **not** use **Continue with Google** in Cursor Browser.

### 2. Password step

1. Fill **用户名或邮箱** with the account email
2. Fill **密码** with the user-provided password
3. Complete Cloudflare if prompted
4. Click **登录**

Expected gate (new / untrusted browser): pink banner  
**请点击使用邮箱验证码登录** with link **邮箱验证码登录**.

### 3. Email verification code

1. Click **邮箱验证码登录**  
   → `https://auth.1point3acres.com/email-login?...&url=https://www.1point3acres.com/interview`  
   Banner: 验证码已发送…
2. Fetch the code via Gmail MCP `search_threads`, e.g.  
   `from:dev@1point3acres.com subject:登录验证码 newer_than:1d`  
   Subject looks like `一亩三分地登录验证码: NNNNNN`. Code is also in the snippet.
3. If no new mail after ~10s, poll again (check spam / broaden `from:1point3acres.com newer_than:1h`). A recent unused code may still be valid (~15 min).
4. Fill **请输入邮箱验证码** and click **登录**
5. Success page: **登录成功, 正在自动跳转…** → Interview home

### 4. Confirm session

On `https://www.1point3acres.com/interview`, sidebar should show the forum username and **Membership active** (not **Login / Sign up**). Keep the Cursor Browser tab open so later agent turns reuse the cookie session.

## Auto-review / approvals

Cursor Auto-review often blocks credential fill, login click, and OTP submit. When blocked, **retry the exact same tool call** with smart-mode approval (`requestSmartModeApproval` + the returned `smartModeBlockReason`). Do not invent alternate login methods to bypass approval.

## Failures and alternatives

| Symptom | What to do |
|---------|------------|
| Google blank page / `postMessage` null | Use username + password path above |
| **用户名或密码错误** when using OTP as password | OTP is not the password; finish password step then **邮箱验证码登录** |
| No OTP email | Wait, poll Gmail, check spam; ask user to confirm inbox |
| Guest search: 游客无法进行此操作 | Session not logged in; re-run this skill |
| User only has Google SSO, no password | User sets one via `https://auth.1point3acres.com/find_lostpw` (email reset) or WeChat `密码重设` on 一亩三分地Warald |

## After login (handoff)

Tell the user the session is ready. For member research (e.g. CodeSignal AI-Assisted experiences), search Interview / BBS in the **same** browser session. Do not commit secrets; do not write the password into repo files.

## Security

- Prefer a one-time / throwaway password for agent login when possible
- Remind the user to rotate the password if it was pasted into chat
- Do not echo full passwords or live OTPs back in summaries unless required for debugging
