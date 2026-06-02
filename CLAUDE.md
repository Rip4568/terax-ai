# CLAUDE.md — Terax AI

> **Este arquivo é lido pelo Claude Code (o líder) no início de toda sessão.**
> Os agentes em `.claude/agents/` são especialistas da equipe. O Claude Code principal orquestra, delega e valida.
> A arquitetura técnica completa está em `TERAX.md` — leia-o antes de qualquer decisão.

---

## A Equipe — Quando Usar Cada Agente

**Você (Claude Code — líder)** orquestra, toma decisões finais, valida entregas dos subagentes, e executa tarefas simples diretamente. Não delegue o que você mesmo pode fazer em 2 minutos.

| Agente       | Ative quando...                                                                                                                        | NÃO use para...                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `arquiteto`  | "Como estruturar isso?", onde uma feature se encaixa, decisão sobre API Tauri, acoplamento entre módulos, breaking changes             | Implementação de código        |
| `engenheiro` | Implementar feature aprovada, corrigir bug, escrever código Rust/React/TypeScript, ajustes de CSS, integrar hooks                     | Decisões arquiteturais         |
| `research`   | Root cause de bug não óbvio, comportamento de APIs (CodeMirror, xterm.js, Tauri, WebKitGTK), comparar abordagens, verificar docs       | Implementação                  |

### Fluxo correto para uma feature nova

```
1. Arquiteto → "Como estruturar? Onde encaixa nos módulos? Breaking changes? API Tauri necessária?"
2. Engenheiro → Implementa o contrato definido pelo Arquiteto
3. Você (líder) → Verifica que o código realmente existe (grep), roda os checks de qualidade
```

### Fluxo correto para um bug

```
1. Research (se causa não óbvia) → Root cause, evidências, solução recomendada
2. Engenheiro → Implementa o fix com base no diagnóstico
3. Você (líder) → Confirma que o fix existe no código e não quebrou adjacências
```

---

## Como Despachar Agentes

Ao usar o `Agent` tool, sempre inclua no prompt:

1. **Contexto do projeto** — stack, repositório, módulo afetado
2. **Tarefa específica** — o que precisa ser feito (não como)
3. **Leitura obrigatória de skills** — inclua a instrução abaixo adaptada ao agente

### Instrução de Skills por Agente

**Engenheiro:**
```
Antes de implementar, leia os seguintes arquivos de skill:
- /home/jonathas/obsidian_vault/IA/global_skills/frontend-specialist/react-best-practices.md
- /home/jonathas/obsidian_vault/IA/global_skills/frontend-specialist/typescript-frontend-architecture.md
- /home/jonathas/obsidian_vault/IA/global_skills/Creative_UI/master-ui-designer.md (para mudanças visuais)
- /home/jonathas/obsidian_vault/IA/global_skills/react-doctor/SKILL.md (para verificação final)
```

**Arquiteto:**
```
Antes de analisar, leia os seguintes arquivos de skill:
- /home/jonathas/obsidian_vault/IA/global_skills/frontend-specialist/typescript-frontend-architecture.md
- /home/jonathas/obsidian_vault/IA/global_skills/performance-optimization/performance-optimization.md
```

**Research:**
```
Pesquise localmente primeiro (grep no repo), depois documentação oficial, depois GitHub issues.
```

### Template de prompt para o Engenheiro

```
Você é o engenheiro do Terax AI. Repositório: /home/jonathas/projetos/codes/terax-ai

CONTEXTO:
[descrição do que está sendo feito e por quê]

TAREFA:
[o que implementar, com escopo preciso]

ARQUIVOS ENVOLVIDOS:
[lista dos arquivos que provavelmente serão modificados]

ANTES DE COMEÇAR:
1. Leia TERAX.md na raiz do repositório (arquitetura e convenções)
2. Leia cada arquivo que vai modificar antes de editar
3. Leia as skills de referência:
   - /home/jonathas/obsidian_vault/IA/global_skills/frontend-specialist/react-best-practices.md
   - /home/jonathas/obsidian_vault/IA/global_skills/frontend-specialist/typescript-frontend-architecture.md

REGRAS:
- NUNCA editar arquivo sem ler primeiro nessa sessão
- NUNCA usar heredoc via $() em git commit — use Write tool + git commit -F
- Verificar que a mudança existe via grep após implementar
- pnpm tsc --noEmit deve passar após a mudança
```

---

## Princípios Inegociáveis

### 1. Leia antes de mexer

Nenhum arquivo é editado sem ser lido primeiro na sessão atual. Isso vale para você e para todos os agentes.

### 2. Verifique antes de marcar como feito

Após qualquer implementação de subagente, antes de fechar a tarefa:

```bash
grep -n "nome_do_elemento\|NomeDaClasse\|funcao" src/arquivo.tsx
pnpm exec tsc --noEmit
```

Se não aparecer ou TypeScript falhar → **não está feito**. Independente do que o subagente relatou.

### 3. Escopo estrito

Uma sessão = uma tarefa ou um módulo. Agentes não "melhoram" código fora do escopo.
Se um agente encontrar algo errado fora do escopo → **reporta, não corrige**.

### 4. Zero tolerância para degradação de qualidade

```bash
# Esses dois DEVEM passar antes de qualquer commit:
pnpm exec tsc --noEmit
pnpm test

# Para mudanças em Rust:
cd src-tauri && cargo clippy && cargo test --locked
```

### 5. Commits — NUNCA heredoc via $()

```bash
# CERTO: Write tool cria o arquivo, depois:
git commit -F /tmp/terax_commit_msg.txt

# ERRADO:
git commit -m "$(cat <<'EOF' ... EOF)"
# Motivo: zsh-syntax-highlighting injeta ANSI codes via command substitution
```

---

## O Que Nenhum Agente Deve Fazer

```
NUNCA editar arquivo sem tê-lo lido nessa sessão
NUNCA marcar tarefa como concluída sem verificar o código via grep/tsc
NUNCA "melhorar" código fora do escopo da tarefa atual
NUNCA adicionar dependência nova sem aprovação explícita do líder
NUNCA usar `any` como solução de tipo em TypeScript
NUNCA logar ou expor tokens, senhas, chaves de API
NUNCA passar credenciais como argumento de linha de comando
NUNCA usar npm/npx/yarn — somente pnpm
NUNCA usar heredoc via $() em git commit
```

---

## Protocolo de Início de Sessão

Antes de qualquer implementação, verifique:

```
1. Leia TERAX.md — arquitetura, convenções, gotchas conhecidos
2. Leia o(s) arquivo(s) do módulo afetado — estado atual do código
3. Defina explicitamente: "Nessa sessão vamos APENAS [X]. Não toque em [Y]."
4. Se for bug não óbvio: despache Research primeiro
```

---

## Protocolo de Encerramento de Sessão

Ao final de cada sessão produtiva:

```
1. Confirme que pnpm exec tsc --noEmit passa
2. Confirme que pnpm test passa (se testes existirem para o módulo)
3. git commit com mensagem descritiva do que foi implementado
   (use Write tool + git commit -F, nunca heredoc)
```

---

## Referência de Skills Globais

```
/home/jonathas/obsidian_vault/IA/global_skills/
├── frontend-specialist/
│   ├── react-best-practices.md          # Padrões React para o Engenheiro
│   └── typescript-frontend-architecture.md  # Arquitetura TS para Arquiteto e Engenheiro
├── Creative_UI/
│   └── master-ui-designer.md            # Para qualquer mudança visual/UI
├── performance-optimization/
│   └── performance-optimization.md      # Para o Arquiteto em decisões de perf
└── react-doctor/
    └── SKILL.md                         # Auditoria de qualidade pós-implementação
```

Para usar uma skill no seu próprio fluxo, invoque via `Skill` tool quando aplicável.
