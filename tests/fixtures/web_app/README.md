# Internal web-app test fixture

This small HTTP/SQLite application checks real application behavior, including data
persistence and invalid requests. It is not installed into products.

From the framework root, run:

```sh
python3 -m unittest discover -s tests/fixtures/web_app -v
```
