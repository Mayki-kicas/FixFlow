# Service de conversion DWG -> SVG.
# Pipeline : dwg2dxf (LibreDWG) pour DWG->DXF, puis ezdxf (rendu) pour DXF->SVG.
# LibreDWG n'est packagé ni dans Debian ni dans Ubuntu -> compilé depuis les sources.

# --- Étape build : compile LibreDWG (fournit /usr/local/bin/dwg2dxf) ---------
FROM python:3.12-slim AS libredwg-build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential autoconf automake libtool pkg-config texinfo \
        git ca-certificates libpcre2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/LibreDWG/libredwg.git /tmp/libredwg \
    && cd /tmp/libredwg \
    && sh autogen.sh \
    && ./configure --disable-bindings --disable-shared --enable-static=no --enable-release \
    && make -j"$(nproc)" \
    && make install \
    && ldconfig

# --- Image finale : runtime Python + binaires LibreDWG --------------------------
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpcre2-8-0 libgl1 fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Récupère dwg2dxf + la lib partagée depuis l'étape build.
COPY --from=libredwg-build /usr/local/bin/dwg2dxf /usr/local/bin/dwg2dxf
COPY --from=libredwg-build /usr/local/lib/ /usr/local/lib/
RUN ldconfig

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
