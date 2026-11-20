# Administration: Templates and Dictionaries

This chapter is for administrators and project leads who control how Experiments look and which choices appear in dropdown lists.

- **Templates** define the structure of an Experiment: its tabs and the components on each tab.
- **Dictionaries** hold the lists of words (for example, storage instructions or sources) offered as options in Experiment inputs.

## Before you start

- **Dictionaries** appears in the left menu only if you have the **Dictionary editor** permission.
- If an item is missing, ask a system administrator to give you the permission.

---

## Templates

Two templates are pre-created: **Default** and **Minimal**. You choose one of them when you create an Experiment (see [Projects, Notebooks and Experiments](02-projects-notebooks-experiments.md)).

> **Not yet available:** managing templates: the **Templates** page, and creating, editing, previewing and deleting templates.

---

## Dictionaries

Indigo ELN comes with ready-to-use dictionaries, for example Therapeutic Area, Health Hazards, Handling Precautions, Storage Instructions, Source and Component State. You edit the words in them. You cannot create new dictionaries.

> **Not yet available:** adding, renaming and deleting dictionaries; searching dictionaries by name; the **My Entities** filter and sorting on the dictionaries page.

### How to open a dictionary

1. Click **Dictionaries** in the left menu.
2. Click a dictionary card (it shows **Name**, **Description**, **Last Edited On** and **Last Edited By**).

A panel opens with a search bar for words, **+Add Word**, and a table with **Rank**, **Name**, **Description**, **Active**, **Created On** and a delete option.

### How to add a word

1. Open the dictionary and click **+Add Word**. A new row appears at the end of the table.
2. Type the word in **Name** (required, unique in the dictionary, up to 256 characters). Optionally fill in **Description**.
3. Click away from the field or press **Enter** to save.

If the name already exists, you see **Name must be unique. Please choose a different name.** and need to fix it before leaving the field. To discard the new row, use its delete option.

### How to edit a word

Changes are saved as soon as you leave the field.

- **Name** and **Description:** click the cell and type.
- **Rank:** drag the word to a new position. Other ranks update automatically.
- **Active:** untick it to stop offering the word as an option in inputs; existing records that use it are not affected. Tick it again to offer the word again.

You can still edit inactive words.

### How to delete a word

1. Open the dictionary and click the delete option in the word's row.
2. If the word is not used anywhere, it is removed.

If the word is selected in any input in the system, it is not deleted. You see **This word is selected in other inputs. Please deactivate the word to remove it from available options of the inputs.**

> Tip: If a word is in use, untick **Active** instead of deleting it.
