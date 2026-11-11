# Security policy

## Supported versions

Only the latest release of the Melimelo integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-melimelo](https://github.com/prohand/gladys-melimelo/security), then
**Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove tokens, passwords and addresses first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes — in particular
the handling of the Melimelo access token and of the household data.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), Melimelo and
its API (report to Melimelo), and the other third-party services this integration talks to.

## How the integration protects your data

- The access token is a **secret** field of the configuration. It is only sent to the
  Melimelo API you configured, in the `Authorization` header, and never written to the logs,
  to an error message or to anything sent to Gladys.
- Only **https** API URLs are accepted (plain http only on the loopback, for development),
  and HTTP redirects are refused, so the token cannot be replayed to another host.
- The container runs as a non-root user on a read-only root filesystem; it only writes a
  short list of the scene triggers already fired in `/data`, kept 45 days at most.

## Good practices for users

- Keep secrets (tokens, passwords, API keys) only in the integration's secret fields.
- Give the integration a token with the least privileges it needs, and revoke it in
  Melimelo if you uninstall the integration.
- Keep Gladys and the integration up to date.
