"""Prepara el mapa local de Granada a partir de la consulta GeoJSON del IGN."""
import json
import sys
from pathlib import Path

from shapely.geometry import mapping, shape

source = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
features = source["features"]
if not features or source["numberMatched"] != len(features):
    raise ValueError("Incomplete result from IGN")


def round_coordinates(coordinates):
    """Recorre polígonos y anillos hasta llegar a cada par longitud/latitud."""
    if isinstance(coordinates[0], (int, float)):
        return [round(value, 6) for value in coordinates]
    return [round_coordinates(component) for component in coordinates]


municipalities = []
bounds = []
for feature in features:
    props = feature["properties"]
    if props["codnut3"] != "ES614" or props["nationallevelname"] != "Municipio":
        raise ValueError("The IGN response contains data outside Granada")
    simplified = shape(feature["geometry"]).simplify(0.00035, preserve_topology=True)
    bounds.append(simplified.bounds)
    geometry = mapping(simplified)
    municipalities.append({
        "type": "Feature",
        "id": props["nationalcode"],
        "properties": {"name": props["nameunit"]},
        "geometry": {
            "type": geometry["type"],
            "coordinates": round_coordinates(geometry["coordinates"]),
        },
    })

result = {
    "type": "FeatureCollection",
    "sourceDate": source["timeStamp"],
    # Guardar la extensión evita crear una segunda capa de polígonos solo para medirla.
    "bbox": [min(b[0] for b in bounds), min(b[1] for b in bounds),
             max(b[2] for b in bounds), max(b[3] for b in bounds)],
    "features": municipalities,
}
target = Path(__file__).resolve().parent.parent / "public" / "granada.geojson"
target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(municipalities)} municipios, {target.stat().st_size} bytes")
