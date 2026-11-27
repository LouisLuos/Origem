"""Consultas ao catálogo treinado e registro de cada uso online."""
import json
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

import recomendador

LOG_PADRAO = Path(__file__).parent / "logs" / "uso.jsonl"


class ProdutoInexistente(LookupError):
    pass


class Catalogo:
    def __init__(self, caminho_modelo, caminho_log=None):
        self.modelo = json.loads(Path(caminho_modelo).read_text(encoding="utf-8"))
        self.log = Path(caminho_log or os.environ.get("ORIGEM_LOG_USO", LOG_PADRAO))
        self.lock = Lock()

    @contextmanager
    def _consulta(self, funcao, origem, **parametros):
        # Texto arbitrário recebido pela API pode conter dados pessoais.
        if "produto_id" in parametros and not re.fullmatch(r"p[0-9]{2,6}", parametros["produto_id"]):
            parametros["produto_id"] = "id_fora_do_formato"
        evento = dict(data_hora=datetime.now(timezone.utc).isoformat(), funcao=funcao,
                      origem=origem, parametros=parametros, ids_retornados=[], status="sucesso")
        try:
            yield evento["ids_retornados"]
        except Exception as exc:
            evento.update(status="erro", motivo=type(exc).__name__, ids_retornados=[])
            raise
        finally:
            evento["quantidade"] = len(evento["ids_retornados"])
            with self.lock:
                self.log.parent.mkdir(parents=True, exist_ok=True)
                with self.log.open("a", encoding="utf-8") as arquivo:
                    arquivo.write(json.dumps(evento, ensure_ascii=False) + "\n")

    def buscar_peca(self, produto_id, origem):
        with self._consulta("buscar_peca", origem, produto_id=produto_id) as ids:
            produto = self.modelo["produtos"].get(produto_id)
            if produto is None:
                raise ProdutoInexistente(produto_id)
            ids.append(produto_id)
            return produto

    def buscar_afins(self, produto, limite, origem):
        with self._consulta("buscar_afins", origem, produto_id=produto["id"], limite=limite) as ids:
            resposta = recomendador.recomendar_peca(self.modelo, produto, limite)
            ids.extend(item["product_id"] for item in resposta["items"])
            return resposta

    def listar_pecas(self, origem):
        with self._consulta("listar_pecas", origem) as ids:
            produtos = self.modelo["produtos"]
            ids.extend(produtos)
            return list(produtos.values())
