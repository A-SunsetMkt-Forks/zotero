general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-print = Imprimir
general-remove = Remover
general-add = Adicionar
general-remind-me-later = Lembrar-me mais tarde
general-dont-ask-again = Não perguntar novamente
general-choose-file = Selecionar arquivo...
general-open-settings = Abrir configurações
general-help = Ajuda
general-tag = Etiqueta
general-done = Feito
general-view-troubleshooting-instructions = Ver instruções de resolução de problemas
general-go-back = Retroceder
citation-style-label = Estilo da citação:
language-label = Idioma:
menu-file-show-in-finder =
    .label = Mostrar no Finder
menu-file-show-file =
    .label = Exibir o arquivo
menu-file-show-files =
    .label = Mostrar arquivos
menu-print =
    .label = { general-print }
menu-density =
    .label = Densidade
add-attachment = Adicionar anexo
new-note = Nova nota
menu-add-by-identifier =
    .label = Adicionar por identificador…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Adicionar arquivo…
menu-add-standalone-linked-file-attachment =
    .label = Adicionar link para arquivo…
menu-add-child-file-attachment =
    .label = Anexar arquivo
menu-add-child-linked-file-attachment =
    .label = Anexar link para o arquivo…
menu-add-child-linked-url-attachment =
    .label = Anexar link para página…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova nota isolada
menu-new-item-note =
    .label = Nova nota de item
menu-restoreToLibrary =
    .label = Restaurar para a biblioteca
menu-deletePermanently =
    .label = Excluir permanentemente
menu-tools-plugins =
    .label = Extensões
menu-view-columns-move-left =
    .label = Mover Coluna à Esquerda
menu-view-columns-move-right =
    .label = Mover Coluna à Direita
main-window-command =
    .label = Library
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Listar todas as abas
filter-collections = Filtrar coleções
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Buscar abas
zotero-tabs-menu-close-button =
    .title = Fechar aba
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Renomear coleção
collections-menu-edit-saved-search =
    .label = Editar pesquisa salva
collections-menu-move-collection =
    .label = Mover para
collections-menu-copy-collection =
    .label = Copiar para
item-creator-moveDown =
    .label = Mover para baixo
item-creator-moveToTop =
    .label = Mover para o topo
item-creator-moveUp =
    .label = Mover para cima
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Arquivo
item-menu-add-linked-file =
    .label = Arquivo relacionado
item-menu-add-url =
    .label = Ligação web
item-menu-change-parent-item =
    .label = Mudar item pai
view-online = Ver online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Arquivo renomeado para { $filename }
itembox-button-options =
    .tooltiptext = Abrir menu de contexto
itembox-button-merge =
    .aria-label = Selecionar versão do campo { $field }
create-parent-intro = Insira um DOI, ISBN, PMID, arXiv ID, ou ADS Bibcode para identificar este arquivo:
reader-use-dark-mode-for-content =
    .label = Usar modo escuro para o conteúdo
update-updates-found-intro-minor = Uma atualização para o { -app-name } está disponível:
update-updates-found-desc = É recomendado que você aplique esta atualização o mais breve possível.
import-window =
    .title = Importar
import-where-from = De onde você deseja importar?
import-online-intro-title = Introdução
import-source-file =
    .label = Um arquivo (BibTeX, RIS, RDF do Zotero, etc.)
import-source-folder =
    .label = Uma pasta de PDFs ou outros arquivos
import-source-online =
    .label = Importação on-line a partir de { $targetApp }
import-options = Opções
import-importing = Importando...
import-create-collection =
    .label = Coloque coleções importadas e itens dentro de novas coleções
import-recreate-structure =
    .label = Recriar estrutura de pastas como coleções
import-fileTypes-header = Tipos de arquivo para importar:
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = Outros padrões de arquivos, separados por vírgula (ex.: *.jpg,*.png)
import-file-handling = Manipulação de arquivo
import-file-handling-store =
    .label = Copiar arquivos para a pasta de armazenamento do { -app-name }
import-file-handling-link =
    .label = Link para arquivos na localização original
import-fileHandling-description = Arquivos linkados não podem ser sincronizados pelo { -app-name }.
import-online-new =
    .label = Baixar apenas itens novos; não atualizar itens importados anteriormente
import-mendeley-username = Usuário
import-mendeley-password = Senha
general-error = Erro
file-interface-import-error = Um erro ocorreu ao tentar importar o arquivo selecionado. Por favor, certifique-se de que o arquivo é válido e tente novamente.
file-interface-import-complete = Importação completa
file-interface-items-were-imported =
    { $numItems ->
        [0] Nenhum item foi importado
        [one] Um item foi importado
       *[other] { $numItems } itens foram importados
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Nenhum item foi religado
        [one] Um item foi religado
       *[other] { $numRelinked } itens foram religados
    }
import-mendeley-encrypted = A base Mendeley selecionada não pode ser lida, possivelmente porque é criptografada. Veja <a data-l10n-name="mendeley-import-kb">Como importar biblioteca do Mendeley para o Zotero?</a> para mais informações.
file-interface-import-error-translator = Ocorreu um erro ao importar o arquivo selecionado com “{ $translator }”. Por favor, verifique se o arquivo e válido e tente novamente.
import-online-intro = No próximo passo será solicitado que faça login no { $targetAppOnline } e permita acesso ao { -app-name }. Isto é necessário para importar sua biblioteca { $targetApp } para o { -app-name }.
import-online-intro2 = { -app-name } jamais verá ou armazenará sua senha do { $targetApp }.
import-online-form-intro = Por favor, informe seus dados de login no { $targetAppOnline }. Isto é necessário para importar sua biblioteca { $targetApp } para o { -app-name }.
import-online-wrong-credentials = Login para { $targetApp } falhou. Por favor, reinsira seus dados e tente novamente.
import-online-blocked-by-plugin = A importação não pode continuar com o { $plugin } instalado. Por favor, desabilite a extensão e tente novamente.
import-online-relink-only =
    .label = Religar citações do Mendeley Desktop
import-online-relink-kb = Mais informações
import-online-connection-error = { -app-name } não conseguiu se conectar ao { $targetApp }. Por favor, verifique sua conexão com a internet e tente novamente.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } nota
            [many] { $count } notas
           *[other] { $count } notas
        }
report-error =
    .label = Relatar erro...
rtfScan-wizard =
    .title = Vasculhar RTF
rtfScan-introPage-description = { -app-name } pode automaticamente extrair e reformatar citações, e inserir uma bibliografia em arquivos RTF. Ele atualmente tem suporte a citações em variações dos seguintes formatos:
rtfScan-introPage-description2 = Para começar, selecione um arquivo RTF de entrada e um arquivo de saída abaixo:
rtfScan-input-file = Arquivo de entrada:
rtfScan-output-file = Arquivo de saída:
rtfScan-no-file-selected = Não foi selecionado nenhum arquivo
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de saída
rtfScan-intro-page = Introdução
rtfScan-scan-page = Procurando por citações
rtfScan-scanPage-description = { -app-name } está analisando seu documento por citações. Por favor, seja paciente.
rtfScan-citations-page = Verificar itens citados
rtfScan-citations-page-description = Por favor, revise a lista de citações reconhecidas para certificar-se que o { -app-name } selecionou os itens correspondentes de forma correta. Quaisquer citações não mapeadas ou ambíguas devem ser corrigidas antes de avançar para o próximo passo.
rtfScan-style-page = Formatação do documento
rtfScan-format-page = Formatando as citações
rtfScan-format-page-description = { -app-name } está processando e formatando seu arquivo RTF. Por favor, seja paciente.
rtfScan-complete-page = A análise do RTF foi concluída
rtfScan-complete-page-description = Seu documento foi vasculhado e processado. Por favor, certifique-se de que ele está formatado corretamente.
rtfScan-action-find-match =
    .title = Selecionar item correspondente
rtfScan-action-accept-match =
    .title = Aceitar esta correspondência
runJS-title = Executar JavaScript
runJS-editor-label = Código:
runJS-run = Executar
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Executar como função assíncrona
bibliography-window =
    .title = { -app-name } - Criar Citação/Bibliografia
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Mostrar citações como:
bibliography-advancedOptions-label = Opções avançadas
bibliography-outputMode-label = Modo de saída:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Método de saída:
bibliography-outputMethod-saveAsRTF =
    .label = Salvar como RTF
bibliography-outputMethod-saveAsHTML =
    .label = Salvar como HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copiar para a área de transferência
bibliography-outputMethod-print =
    .label = Imprimir
bibliography-manageStyles-label = Gerenciar estilos...
integration-docPrefs-window =
    .title = { -app-name } - Preferências do documento
integration-addEditCitation-window =
    .title = { -app-name } - Adicionar/Editar citação
integration-editBibliography-window =
    .title = { -app-name } - Editar bibliografia
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Editar referência
-integration-editBibliography-include-uncited = To include an uncited item in your bibliography, select it from the items list and press { general-add }.
-integration-editBibliography-exclude-cited = You can also exclude a cited item by selecting it from the list of references and pressing { general-remove }.
-integration-editBibliography-edit-reference = To change how a reference is formatted, use the text editor.
integration-editBibliography-wrapper =
    .aria-label = Edit Bibliography dialog
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-quickFormatDialog-window =
    .title = { -app-name } - Formatação rápida de citação
styleEditor-locatorType =
    .aria-label = Tipo de localizador
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Editor de Estilos
styleEditor-preview =
    .aria-label = Visualização
integration-prefs-displayAs-label = Exibir citações como:
integration-prefs-footnotes =
    .label = Notas de rodapé
integration-prefs-endnotes =
    .label = Notas de fim
integration-prefs-bookmarks =
    .label = Guardar citações como marcadores
integration-prefs-bookmarks-description = Os marcadores podem ser compartilhados entre o Word e o LibreOffice, mas podem causar erros caso sejam modificados acidentalmente e não podem ser inserido nas notas de rodapé.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Atualizar citações automaticamente
    .tooltip = Citações com atualizações pendentes serão destacadas no documento
integration-prefs-automaticCitationUpdates-description = Desativar atualizações acelera a inserção de citação em documentos grandes. Clique em Refresh para atualizar citações manualmente.
integration-prefs-automaticJournalAbbeviations =
    .label = Usar as abreviaturas de periódicos MEDLINE
integration-prefs-automaticJournalAbbeviations-description = O campo "Abreviatura do periódico" será ignorado.
integration-prefs-exportDocument =
    .label = Trocar para um Editor de Texto diferente...
integration-error-unable-to-find-winword = { -app-name } não conseguiu encontrar uma instância do Word em execução.
publications-intro-page = Minhas Publicações
publications-intro = Itens que você adiciona a Minhas Publicações serão mostrados na sua página de perfil em zotero.org. Se você escolher incluir arquivos anexos, eles serão disponibilizados publicamente sob a licença que você especificar. Adicione apenas trabalhos que foram criados por você e inclua arquivos apenas se você tem direitos de distribuição e assim o deseja.
publications-include-checkbox-files =
    .label = Incluir arquivos
publications-include-checkbox-notes =
    .label = Incluir notas
publications-include-adjust-at-any-time = Você pode a qualquer momento ajustar o que mostrar da coleção Minhas Publicações.
publications-intro-authorship =
    .label = Eu criei este trabalho.
publications-intro-authorship-files =
    .label = Eu criei este trabalho e tenho os direitos de distribuição dos arquivos inclusos.
publications-sharing-page = Escolha como o seu trabalho pode ser compartilhado
publications-sharing-keep-rights-field =
    .label = Mantenha o campo de Direitos existente
publications-sharing-keep-rights-field-where-available =
    .label = Mantenha o campo de Direitos existente quando disponível
publications-sharing-text = Você pode reservar todos os direitos para seu trabalho usando a licença Creative Commons ou deixá-lo em domínio público. Em ambos os casos, o trabalho ficará publicamente disponível em zotero.org.
publications-sharing-prompt = Você gostaria de permitir que o seu trabalho seja compartilhado por outros?
publications-sharing-reserved =
    .label = Não, somente publique meu trabalho no zotero.org
publications-sharing-cc =
    .label = Sim, sob uma licença Creative Commons
publications-sharing-cc0 =
    .label = Sim, e coloque meu trabalho em domínio público
publications-license-page = Escolha uma licença Creative Commons
publications-choose-license-text = Uma licença Creative Commons permite que outros copiem e redistribuam seu trabalho com o devido crédito, forneça um link para a licença e indique se houver mudanças. Condições adicionais podem ser especificadas abaixo.
publications-choose-license-adaptations-prompt = Permitir que adaptações do seu trabalho sejam compartilhadas?
publications-choose-license-yes =
    .label = Sim
    .accesskey = Y
publications-choose-license-no =
    .label = Não
    .accesskey = N
publications-choose-license-sharealike =
    .label = Sim, desde que os outros compartilhem da mesma forma
    .accesskey = S
publications-choose-license-commercial-prompt = Permitir usos comerciais do seu trabalho?
publications-buttons-add-to-my-publications =
    .label = Adicionar às Minhas Publicações
publications-buttons-next-sharing =
    .label = Próximo: Compartilhar
publications-buttons-next-choose-license =
    .label = Escolha a licença
licenses-cc-0 = CC0 1.0 Dedicação Universal de Domínio Público
licenses-cc-by = Licença Creative Commons Attribution 4.0 International
licenses-cc-by-nd = Licença Creative Commons Attribution-NoDerivatives 4.0 International
licenses-cc-by-sa = Licença Creative Commons Attribution-ShareAlike 4.0 International
licenses-cc-by-nc = Licença Creative Commons Attribution-NonCommercial 4.0 International
licenses-cc-by-nc-nd = Licença Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International
licenses-cc-by-nc-sa = Licença Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
licenses-cc-more-info = Certifique-se que leu as <a data-l10n-name="license-considerations">Considerações para licenças</a>do Creative Commons antes de colocar seu trabalho sob a licença CC. Saiba que a licença que você aplica não pode ser retirada, mesmo que posteriormente escolha termos diferentes ou retire a publicação do trabalho.
licenses-cc0-more-info = Certifique-se que leu as <a data-l10n-name="license-considerations">CC0 FAQ</a> do Creative Commons antes de aplicar CC0 a seu trabalho. Saiba que a colocar seu trabalho em domínio público é irreversível, mesmo que posteriormente escolha termos diferentes ou retire a publicação do trabalho.
restart-in-troubleshooting-mode-menuitem =
    .label = Reiniciar no modo de resolução de erros...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Reiniciar no modo de resolução de erros
restart-in-troubleshooting-mode-dialog-description = { -app-name } iniciará com todas as extensões desabilitadas. Alguns recursos podem não funcionar corretamente enquanto o modo de resolução de erros está ativo.
menu-ui-density =
    .label = Densidade
menu-ui-density-comfortable =
    .label = Confortável
menu-ui-density-compact =
    .label = Compacto
pane-item-details = Detalhes do Item
pane-info = Informações
pane-abstract = Resumo
pane-attachments = Anexos
pane-notes = Notas
pane-libraries-collections = Bibliotecas e Coleções
pane-tags = Etiquetas
pane-related = Relacionar
pane-attachment-info = Informação de anexo
pane-attachment-preview = Visualização
pane-attachment-annotations = Anotações
pane-header-attachment-associated =
    .label = Renomear arquivo associado
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } anexo
            [many] { $count } anexos
           *[other] { $count } anexos
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } anotação
            [many] { $count } anotações
           *[other] { $count } anotações
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } nota
            [many] { $count } notas
           *[other] { $count } notas
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } etiqueta
            [many] { $count } etiquetas
           *[other] { $count } etiquetas
        }
section-related =
    .label = { $count } relacionado
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Expandir seção
    .label = Expandir a secção { $section }
section-button-collapse =
    .dynamic-tooltiptext = Comprimir seção
    .label = Colapsar a secção { $section }
annotations-count =
    { $count ->
        [one] { $count } anotação
        [many] { $count } anotações
       *[other] { $count } anotações
    }
section-button-annotations =
    .title = { annotations-count }
    .aria-label = { annotations-count }
attachment-preview =
    .aria-label = { pane-attachment-preview }
sidenav-info =
    .tooltiptext = { pane-info }
sidenav-abstract =
    .tooltiptext = { pane-abstract }
sidenav-attachments =
    .tooltiptext = { pane-attachments }
sidenav-notes =
    .tooltiptext = { pane-notes }
sidenav-attachment-info =
    .tooltiptext = { pane-attachment-info }
sidenav-attachment-preview =
    .tooltiptext = { pane-attachment-preview }
sidenav-attachment-annotations =
    .tooltiptext = { pane-attachment-annotations }
sidenav-libraries-collections =
    .tooltiptext = { pane-libraries-collections }
sidenav-tags =
    .tooltiptext = { pane-tags }
sidenav-related =
    .tooltiptext = { pane-related }
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
pin-section =
    .label = Fixar seção
unpin-section =
    .label = Desafixar seção
collapse-other-sections =
    .label = Comprimir outras seções
expand-all-sections =
    .label = Expandir todas seções
abstract-field =
    .placeholder = Adicionar resumo...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrar etiquetas
context-notes-search =
    .placeholder = Pesquisar notas
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nova coleção...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova coleção
    .buttonlabelaccept = Criar coleção
new-collection-name = Nome:
new-collection-create-in = Criar em:
attachment-info-title = Título
attachment-info-filename = Nome do arquivo
attachment-info-accessed = Acessado em
attachment-info-pages = Páginas
attachment-info-modified = Data de modificação
attachment-info-index = Indexado
attachment-info-convert-note =
    .label =
        Migrar para nota { $type ->
            [standalone] isolada
            [child] filha
           *[unknown] nova
        }
    .tooltiptext = Adicionar notas nos anexos não é mais permitido, mas você pode editar esta nota transformando em uma nota separada.
attachment-preview-placeholder = Sem anexo para visualizar
toggle-preview =
    .label =
        { $type ->
            [open] Esconder
            [collapsed] Mostrar
           *[unknown] Toggle
        } visualização de anexo
quickformat-general-instructions =
    Utilizar setas esquerda/direita para navegar pelos itens desta citação. { $dialogMenu ->
        [active] Pressione Shift-Tab para focar no menu.
       *[other] { "" }
    } Pressione { return-or-enter } para salvar edições a esta citação. Pressione Escape para descartar as mudanças e fechar a janela.
quickformat-aria-bubble = Este item está incluído na citação. Pressione a barra de espaço para customizar o item. { quickformat-general-instructions }
quickformat-aria-input = Digitar para pesquisar por um item para incluir na citação. Pressione Tab para navegar a lista de resultados de pesquisa. { quickformat-general-instructions }
quickformat-aria-item = Pressione { return-or-enter } para adicionar este item na citação. Pressione Tab para voltar para o campo de busca.
quickformat-accept =
    .tooltiptext = Salvar edições desta citação
quickformat-locator-type =
    .aria-label = Tipo de localizador
quickformat-locator-value = Localizador
quickformat-citation-options =
    .tooltiptext = Mostrar opções de citação
insert-note-aria-input = Digitar para buscar por uma nota. Pressionar Tab para navegar a lista de resultados. Pressionar Escape para fechar a janela.
insert-note-aria-item = Pressionar { return-or-enter } para selecionar esta nota. Pressionar Tab para voltar para o campo de busca. Pressionar Escape para fechar a janela.
quicksearch-mode =
    .aria-label = Modo busca rápida
quicksearch-input =
    .aria-label = Pesquisa rápida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Ver como
item-pane-header-none =
    .label = Nenhum
item-pane-header-title =
    .label = Título
item-pane-header-titleCreatorYear =
    .label = Título, autor, ano
item-pane-header-bibEntry =
    .label = Entrada bibliográfica
item-pane-header-more-options =
    .label = Mais opções
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } coleção selecionada
        [many] { $count } coleções selecionadas
       *[other] { $count } coleções selecionadas
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } pesquisa selecionada
        [many] { $count } pesquisas selecionadas
       *[other] { $count } pesquisas selecionadas
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objeto selecionado
        [many] { $count } objetos selecionados
       *[other] { $count } objetos selecionados
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = Você deve escolher um resolvedor a partir do painel { $pane } nas configurações do { -app-name } .
architecture-win32-warning-message = Mude para { -app-name } 64-bit para ter uma performance melhor. Seus dados não serão afetados.
architecture-warning-action = Baixar { -app-name } 64-bit
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Baixar { -app-name } para ARM64
first-run-guidance-quickFormat =
    Digitar um título, autor e/ou um ano para buscar uma referência.
    
    Após selecionar, clicar no balão ou selecionar pelo teclado e pressionar ↓/Espaço para mostrar as opções de citação como número de página, prefixo e sufixo.
    
    Vocês também pode adicionar o número de página diretamente ao incluir com os termos da sua busca ou digitar depois do balão e pressionar { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } permite que você especifique editores e tradutores também. Você pode transformar um autor em um editor ou tradutor selecionando a partir deste menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Critérios de busca
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operador
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valor
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } arquivo adicionado
        [many] { $count } arquivos adicionados
       *[other] { $count } arquivos adicionados
    }
select-items-dialog =
    .buttonlabelaccept = Selecionar
select-items-convertToStandalone =
    .label = Convert to Standalone
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Converter para anexo isolado
            [many] Converter para anexos isolados
           *[other] Converter para anexos isolados
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convert to Standalone Note
           *[other] Convert to Standalone Notes
        }
file-type-webpage = Página web
file-type-image = Imagem
file-type-pdf = PDF
file-type-audio = Áudio
file-type-video = Vídeo
file-type-presentation = Apresentação
file-type-document = Documento
file-type-ebook = Livro eletrônico
post-upgrade-message = Learn about the <a data-l10n-name="new-features-link">new features in { -app-name } { $version }</a>
post-upgrade-density = Choose your preferred layout density:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Paste and Search
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Instalar Extensão do Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
