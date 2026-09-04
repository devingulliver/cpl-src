# CPL Sports Research Collections

## Review panel

The review panel is the librarian-facing workspace for maintaining catalog records. It can be used to update image records, audio records, metadata, media links, and interview transcripts.

Open the panel at `/admin` while the application is running.

## Find a record

1. Use the **Search catalog** field to search by record ID, title, collection, description, format, or year.
2. Select a record from the list.
3. The selected record opens in the editor. The right side shows an image preview or audio playback when a media URL is available.

## Edit an existing record

1. Select the record you want to review.
2. Update any of the available fields:
	- Title
	- Source date
	- Archive date
	- Author
	- Collection
	- Sport
	- Team
	- Year
	- Description
	- Image URL
	- Audio URL
3. For Audio records, update the **Transcript** field with the complete SRT text.
4. Select **Save record**.
5. Wait for the status message **Record saved to SQL database.**

Changes are not saved while typing. A record marked **Edited locally** has unsaved changes.

## Add a new record

1. Select **Add new record**.
2. Enter a unique record ID. Use the collection's established ID pattern when one exists.
3. Enter the title and the available catalog metadata.
4. Select the record format: **Image** or **Audio**.
5. Add the appropriate media URL:
	- Image records use **Image URL**.
	- Audio records use **Audio URL**.
6. For an Audio record, paste the complete SRT transcript into **Transcript**. See the technical documentation for generating an SRT file with WhisperX.
7. Select **Save record**.

The new record appears at the top of the catalog list after it has been saved. Record IDs must be unique; if an ID is already in use, change it and try again.

## Audio and transcripts

Use the audio player on the right to check that an Audio record points to the correct recording. The transcript editor accepts raw SRT text, including cue numbers, timestamps, and speaker labels. Keep the SRT formatting intact so the public audio viewer can synchronize the transcript with playback.

## Image records

Paste the direct image URL into **Image URL**. The preview appears on the right when the URL is reachable. Check the preview before saving so an incorrect or incomplete URL is caught during review.

## Review habits

- Confirm the record ID before changing a record.
- Check dates, collection, sport, and team values against the source material.
- Preview the media link before saving.
- For transcripts, check the opening and closing timestamps and skim for obvious speaker or alignment errors.
- Save one record before moving to another so edits are not left only in the browser.

## Delete a record

1. Select the record to remove.
2. Confirm that the title and ID are correct.
3. Select **Delete record**.
4. Confirm the warning dialog.

Deletion removes the catalog record and any linked transcript from the database. It cannot be undone through the panel, so make sure the record is no longer needed before confirming. Contact the technical maintainer if a deleted record needs to be restored from a database backup.
