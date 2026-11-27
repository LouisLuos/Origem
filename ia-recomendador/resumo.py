"""Resume o uso online e compara os IDs devolvidos com o catálogo do mock."""
import argparse
import json
import os
from collections import Counter
from pathlib import Path

from acesso import LOG_PADRAO

DADOS = Path(__file__).parent / "dados" / "catalogo.json"


def resumir(log, catalogo):
    chamadas, motivos, retornos, buscas = Counter(), Counter(), Counter(), Counter()
    with log.open(encoding="utf-8-sig") as arquivo:
        for linha in arquivo:
            evento = json.loads(linha)
            chamadas[evento["funcao"]] += 1
            retornos.update(evento["ids_retornados"])
            if evento["status"] == "erro":
                motivos[evento["motivo"]] += 1
            elif evento["funcao"] == "buscar_peca":
                buscas.update(evento["ids_retornados"])
    produtos = json.loads(catalogo.read_text(encoding="utf-8"))["produtos"]
    universo = {p["id"] for p in produtos}
    return {
        "chamadas": {nome: chamadas[nome] for nome in ("buscar_peca", "buscar_afins", "listar_pecas")},
        "erros": sum(motivos.values()), "motivos": dict(motivos),
        "consultas_diretas": dict(buscas.most_common()),
        "retornos_por_peca": dict(retornos.most_common()),
        "nunca_retornadas": sorted(universo - retornos.keys()),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", type=Path, default=os.environ.get("ORIGEM_LOG_USO", LOG_PADRAO))
    parser.add_argument("--catalogo", type=Path, default=DADOS)
    args = parser.parse_args()
    if not args.log.exists():
        parser.exit(1, "Log ainda não gerado. Execute as três chamadas do README.\n")
    print(json.dumps(resumir(args.log, args.catalogo), ensure_ascii=False, indent=2))
