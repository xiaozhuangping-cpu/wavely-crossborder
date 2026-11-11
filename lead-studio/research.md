# 平台与方案调研（2026-11-10）

以下是文档明确覆盖的能力，不能将某一账号类型、业务或入口的规则推及整个平台。商业引流、展示微信二维码、外链发布位置和私信权限需在实际上线账号及业务类目下进一步向平台确认。

## 已确认的能力与限制

- 独立网页可提交并本地持久化，收到本机终端通知，展示配置的联系方式；可选 SMTP 代码已实现，真实邮件服务未接通。
- 小红书：[小程序开放平台](https://miniapp.xiaohongshu.com/docs/frame/globalConfiguration)列出商家主页、小程序笔记等入口；要求主体资料认证、选择类目并上传资质、备案、发布审核。[客服消息概述](https://miniapp.xiaohongshu.com/doc/DC186586)说明用户可通过小程序客服与商家客服沟通。具体账号资格和目标业务能否通过审核须确认。
- 抖音：[小程序商家客服](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/open-capacity/operation/private-account/customer-service/tools-for-merchants)支持用户在小程序内主动发起咨询，并有自动回复配置。针对特定电商创作者小程序的[管理规范](https://school.jinritemai.com/doudian/web/articlev0/aJVTCZBMiDJF)要求相关主体资质与审核，且禁止其小程序内含网址、社交账号、二维码等外网信息；这不等同于所有抖音场景的规则。该特定路径还有试点门槛，不能假设本项目符合。
- 闲鱼：[快速接入](https://open.goofish.com/doc/quick-start.html)称小程序目前仅面向运营定向邀请的服务商；需签约企业账号、相应 AppKey，相关主体一致。[服务端接入](https://open.goofish.com/doc/development/dev/server.html)说明所需 TOP API 须申请权限。不能假设普通个人账号可开通。

## 未确认或需要申请

| 渠道 | 外链与微信 | 主动客服 / 加好友 | 提交后平台消息 |
| --- | --- | --- | --- |
| 小红书 | 未确认本业务及账号能否在笔记、主页、私信放外链或微信码 | 小程序用户可主动联系客服；微信加好友不属于上述能力 | 未确认本业务能否向客户自动发消息、触发条件和接收人；无接入 |
| 抖音 | 普通账号和各场景外链未确认；上述特定电商小程序明确限制外网信息 | 小程序可主动联系客服；未确认微信加好友 | 未确认提交后能否自动向客户发消息及条件；客服自动回复不等同于任意主动触达 |
| 闲鱼 | 未确认外链及微信码允许位置 | 未确认适用于本业务的客服或加好友方式 | 未确认可用接口、对象和触发条件；无接入 |

平台内入口、资质、适用规则和可用消息接口均需按账号及业务申请、审核并复核；本演示没有平台接入。

## 技术选型比较

- **Python + SQLite 自建演示（采用）**：标准库、零安装依赖、单机持久化，代码范围小；需要自行实现上线所需身份认证、防滥用、备份和可靠通知。SQLite 为公有领域项目，详见 [SQLite 版权说明](https://www.sqlite.org/copyright.html)。
- **Formbricks**：[仓库与说明](https://github.com/formbricks/formbricks)支持表单与自托管，[发布记录](https://github.com/formbricks/formbricks/releases)显示近期仍有维护；[许可证](https://github.com/formbricks/formbricks/blob/main/LICENSE)存在不同目录许可证，主体 AGPLv3，企业目录及部分 SDK 条款需逐项核对。其[生产部署说明](https://github.com/formbricks/formbricks/blob/main/docker/README.md)要求服务器、域名、Docker 等；具体跟进状态、报价和通知需要进一步验证或二次开发。比本地零依赖演示更重。
- **Typebot**：[官方仓库](https://github.com/baptisteArno/typebot.io)支持自托管，[发布记录](https://github.com/baptisteArno/typebot.io/releases)显示仍有维护，但仓库说明采用 Functional Source License，不能简单等同传统开源许可；具体用途须核对其条款。需求跟进、报价和可靠通知仍需核验。对这一版固定表单与收件箱并非必要。

公开使用前重新核验许可证、服务版本及费用。本演示未复制以上项目代码。
