## ADDED Requirements

### Requirement: Solicitação de histórico sob demanda

O sistema SHALL solicitar histórico antigo ao WhatsApp via
`POST /message/history-sync` (recuando a partir da mensagem âncora mais antiga
conhecida do grupo), para recuperar mensagens anteriores à janela do pareamento.
O acoplamento MUST viver no client (`requestHistorySync`). A entrega é assíncrona;
o sistema MUST tolerar isso (esperar e reconsultar) e MUST parar por grupo quando o
histórico não recua mais.

#### Scenario: Dispara history-sync recuando

- **WHEN** um grupo tem mensagens e roda `sync-history`
- **THEN** o sistema chama `/message/history-sync` com a âncora mais antiga e um `count`, solicitando mensagens anteriores

#### Scenario: Para quando esgota

- **WHEN** após um disparo o histórico não recua dentro da janela de espera
- **THEN** o sistema para para aquele grupo (limite do que o WhatsApp devolve), sem abortar os demais

#### Scenario: Reimport traz o que chegou

- **WHEN** após o sync o `import-uazapi` roda de novo
- **THEN** as mensagens antigas recebidas entram por dedup (`on conflict do nothing`) e `verify-import` reflete o ganho
