# Workspace Structure

## Library

All items live in `$APPDIR/papers/`. Each item is a folder containing:
- `meta.yaml` - Metadata including `type` (paper|slides|document)
- `source.pdf` - Original file
- `content.md` - Parsed text (papers only)
- `notes.md` - Your notes
- `annotations.json` - Highlights (papers only)

## Finding Things

- By title: `grep -r "title: Attention" $APPDIR/papers/*/meta.yaml`
- By type: `grep -r "type: slides" $APPDIR/papers/*/meta.yaml`
- Full text: `rg "transformer" $APPDIR/papers/`

## Adding Item Notes

Write to `$APPDIR/papers/{item-folder}/notes.md`
