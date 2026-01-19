-- Add tokenCount column to document_chunks table
-- This column stores the token count for budget enforcement during RAG queries

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_chunks' AND column_name = 'tokenCount'
    ) THEN
        ALTER TABLE document_chunks ADD COLUMN "tokenCount" INTEGER;
    END IF;
END $$;
