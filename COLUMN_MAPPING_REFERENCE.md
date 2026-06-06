# Column Mapping Reference - Real Excel Files

## VENDAS file (data 90.xlsx) - 1138 rows
Headers: "Data da NF","Data do Pedido","Cód Grupo","Grupo Cliente","Nota Fiscal","Pedido","Cód. Cliente","Nome do Cliente","Segmentação","Categoria","Cód. Produto","Nome do Produto","Qtde. Sacos","Preço por Saco","Preço por KG","PMR","Desconto %","Município","UF","Região","Cód. RC","Representante","Tipo de Operação","Cód. Filial","Grupo Produto","Faturamento Realizado","Faturamento S/ Encargos","MB CB %","MB CB Total","ML CB % (Estimada)","ML CB Total (Estimada)","Volume (Vendas)","Volume (Vendas + Bon.)","Bonificação","ICMS Total","PIS Total","Cofins Total","Custo Brill Total","Desp Comercial","Frete Carga Realizado","Volume (Convertido)","Customizado","Cód Grupo Produto","Solução","Subsolução","Linha","GRV","GNV","Mês/Ano","Filial","Cód CFOP","FL_VEF","Comissão Realizado %","Comissão Realizado","Moeda Pedido","Ano"

Key mapping:
- dataNF -> "Data da NF"
- codCliente -> "Cód. Cliente"
- nomeCliente -> "Nome do Cliente"
- codProduto -> "Cód. Produto"
- nomeProduto -> "Nome do Produto"
- qtdeSacos -> "Qtde. Sacos"
- precoSaco -> "Preço por Saco"
- representante -> "Representante"
- municipio -> "Município"
- uf -> "UF"
- pedidoNumber -> "Pedido"
- notaFiscal -> "Nota Fiscal"
- segmentacao -> "Segmentação"
- categoria -> "Categoria"
- linha -> "Linha"
- descontoPct -> "Desconto %"
- bonificacao -> "Bonificação" (numeric, 0 = not bonificação)

Sample row: 46169,46146,"011712","GRUPO...","000272985","276172","052389","CLAYTON GONCALVES DORNELAS","B","PRODUTOR RURAL","1677501","BOVILACTA MILK",80,124.0625,4.135,75,-0.0595,"ABADIA DOS DOURADOS","MINAS GERAIS","SUDESTE","001360","ANESIO JUNIOR-F. AGRO LTDA","Vendas",...

## PEDIDOS EM CARTEIRA file (data 91.xlsx) - 110 rows
Headers: "Status Tracking","Filial","Pedido","Pedido Green","Pré Carga","Carga","Inclusão do Pedido","Prev. Fat. Solicitada","Prev. Fat. Real","Faturamento Real","Entrega Solicitada","Entrega Real","Bloqueio","Motivo Bloqueio Financeiro","Motivo Bloqueio Prescrição","Diretoria","GEV","GRV","Cód ERC","ERC","Cód Cliente","Cliente","Categoria","Seg.","Linha","Cód. Produto","Produto","OC","Motorista","DDD","Tel Motorista","Pedido Valor","Pedido Volume","É VEF?"

Key mapping:
- pedidoNumber -> "Pedido"
- codCliente -> "Cód Cliente" (note: no dot after Cód)
- nomeCliente -> "Cliente"
- codProduto -> "Cód. Produto"
- nomeProduto -> "Produto"
- qtdeSacos -> "Pedido Volume"
- precoSaco -> calculate from "Pedido Valor" / "Pedido Volume"
- representante -> "GRV"
- categoria -> "Categoria"
- linha -> "Linha"
- dataPedido -> "Inclusão do Pedido" (Excel serial number)
- status -> "Status Tracking" (e.g. "1. Bloqueado")

Sample row: "1. Bloqueado","010035","006624","1604000116","-1",null,46164,46171,null,null,2,null,"Financeiro","Nova venda após liquidação...",null,"RAUL...","ADHEMAR...","CLAUDIO LUIZ XAVIER NUNES","001604","JOHN KLEBER...","048137","ANTONIO CESAR...","PRODUTOR RURAL","C","NUTRICAO RUMINANTES","1683006","TECNOBOV CONF HD","",null,null,null,36085.56,7500,"N"

## IMPORTANT NOTES
1. Column names have accents and dots - COLUMN_MAPPING must include these exact variants
2. Dates are Excel serial numbers (46169 = days since 1900-01-01)
3. For pedidos, price = Pedido Valor / Pedido Volume
4. Bonificação in vendas is numeric volume column
5. Status Tracking values: "1. Bloqueado", etc.
