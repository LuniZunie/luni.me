# SeqR 2: A Beginner's Guide

This tutorial will walk you through the essential features of SeqR 2, a powerful tool for visualizing genomic data. You'll learn how to load your data, organize it into meaningful groups, and create clear visualizations.

1.  **Loading Your Genomic Data**
    *   The first step is to load your data file. SeqR 2 supports common genomic annotation formats like GFF3 and BED.
    *   Find the **"Add File"** button in the top-left corner of the application.
    *   Click it and select your file from the dialog.
    *   The file will be processed and loaded. Large files may take a moment to be chunked and stored efficiently.

2.  **Understanding the Data Selector**
    *   After loading, your file appears in the **Data Selector** panel on the left.
    *   This panel lists all loaded files, showing the file name and status.
    *   You can load multiple files, and they will all be listed here.

3.  **Automatic Feature Grouping**
    *   SeqR 2 automatically organizes features from your file into **groups**, usually by their `type` (e.g., "gene", "exon").
    *   These groups appear in the **Groups** panel below the Data Selector.
    *   Each group is assigned a default name and a unique color for easy identification.

4.  **Customizing Groups**
    *   You have full control over how features are grouped.
    *   **Create a New Group**: Click the `+` button at the top of the Groups panel.
    *   **Rename a Group**: Double-click a group's name to edit it.
    *   **Change Group Color**: Click the color swatch next to a group's name to open the color picker.
    *   **Add Features to a Group**: Select feature types in the **File Viewer** (center panel) and drag them into your custom groups.

5.  **Visualizing Your Data**
    *   The main **visualization canvas** on the right is where your genomic features are drawn.
    *   Click the **"Draw"** button in the top bar to render the visualization based on your group setup.
    *   Each group is rendered on its own track, with features colored according to their group color.

6.  **Adjusting the View**
    *   Fine-tune the visualization using the **Draw Settings** panel.
    *   Adjust properties like **feature height**, **spacing** between elements, and the overall **layout**.
    *   Click the **"Draw"** button again to apply your changes to the canvas.

7.  **Undoing and Redoing Actions**
    *   If you make a mistake, use the undo and redo buttons.
    *   Look for the undo (`↶`) and redo (`↷`) icons in the top bar to step backward or forward through your recent actions.

By following these steps, you can go from a raw data file to a customized, insightful visualization of your genomic data. Happy exploring!
