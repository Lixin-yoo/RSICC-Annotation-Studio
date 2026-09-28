# RSICC Annotation Studio

RSICC Annotation Studio is a local Windows tool for annotating remote sensing image change captions. It presents bi-temporal images alongside a change mask and helps research teams write, review, and manage five descriptions for each image pair. Existing RSICC-style JSON annotations can be imported without changing the source file.

## Features

- Side-by-side Time 1 and Time 2 image viewers with synchronized zoom and pan.
- Searchable task list, progress tracking, and annotation status filters.
- Five caption fields, explicit change/no-change labels, and checks for missing or duplicate descriptions.
- Automatic recovery drafts, version history, backups, and atomic JSON saves.
- Configurable dataset and output paths, autosave interval, theme, font size, and image display options.
- JSON and CSV export. JSON retains the existing annotation structure; CSV provides one row per caption.

## Download and run

Download `RSICCStudio-Windows-x64.zip` from the repository's **Releases** page. Extract it and run `RSICCStudio.exe`. Keep the `_internal` directory beside the executable. The package includes its Python runtime; no separate Python installation or internet connection is required. The launcher opens the annotation workbench in your default browser on `127.0.0.1`.

The software package does not contain dataset images or annotation records. At first launch, open **Settings** and select a dataset root and a separate output directory. To continue existing work, use **Import annotations** to select your JSON file. The import copies and checks the data; it does not edit the source file.

## Dataset layout

```text
dataset/
  train/
    A/sample.png        # Time 1
    B/sample.png        # Time 2
    label/sample.png    # Change mask
  val/
    A/...
    B/...
    label/...
  test/
    A/...
    B/...
    label/...
```

At least one split is required. Images are matched by filename within each split. Missing or damaged images are reported in the workbench. The viewer supports standard 8-bit RGB and grayscale imagery; prepare a visualized 8-bit image before importing 16-bit or multispectral data. Browsing does not modify the original images.

## Annotation workflow

1. Choose a sample from the task list and compare the two images and the change mask.
2. Select the scenario and change status, then enter five distinct descriptions.
3. Review the captions and use **Check and save** to write the formal annotation record.
4. Use **Export** to create a new JSON or CSV file in the output directory's `exports` folder.

Autosave stores a recovery draft. A draft is not part of the formal JSON export until it passes the save checks. Saved records retain their image and sentence IDs. Imported historical ID problems are flagged for review; the application never silently renumbers the source annotations.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Check and save |
| Ctrl+Enter | Save and open the next sample |
| Alt+Left / Alt+Right | Previous / next sample |
| Ctrl+Z / Ctrl+Y | Undo / redo text editing |
| F | Fit images to the viewer |
| Mouse wheel / drag | Zoom / pan |

## Data format and safety

Formal annotations are stored in `annotations.json` with an `images` array. Each record includes `filepath`, `filename`, `imgid`, `split`, `changeflag`, `sentences`, and `sentids`. Each sentence includes `tokens`, `raw`, `imgid`, and `sentid`. Existing extra fields are preserved when importing and editing records.

The output directory also contains a recovery database and backups. For migration, close the application and copy the entire output directory, not just `annotations.json`. Use one application instance per output directory. The application runs locally and is not a multi-user server.

## Reproducing validation methods

For benchmark validation with RSICCformer, PSNet, PromptCC, Chg2Cap, RSCaMa, SparseFocus, and SEN, see the method entries in [Awesome-RS-SpatioTemporal-VLMs](https://github.com/Chen-Yang-Liu/Awesome-RS-SpatioTemporal-VLMs). The repository collects papers and available code/project links. Follow each method's original implementation for its environment, preprocessing, training, and evaluation settings, and document any changes made for RSICC-VL. This annotation tool does not include a unified training or evaluation pipeline for those methods.

## Source and build

The source package is `RSICCStudio-Source.zip`. On Windows x64 with Python 3.13:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe launcher.py
.venv\Scripts\python.exe build.py
```

The build creates `dist\RSICCStudio\RSICCStudio.exe` and its required `_internal` directory. Run the checks described in `TEST_REPORT.md` before distributing a rebuilt package.

The bundled executable was tested on Windows 10 x64. Operation on a separate clean Windows computer has not yet been verified. The executable is unsigned, so Windows may identify it as an unknown publisher.
