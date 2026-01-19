-- Add smart document processing fields to application_documents table

-- Detected document type (auto-detected from content)
ALTER TABLE "application_documents" ADD COLUMN "detectedType" TEXT;

-- Crawl configuration for URL_CRAWL source type
ALTER TABLE "application_documents" ADD COLUMN "crawlDepth" INTEGER;
ALTER TABLE "application_documents" ADD COLUMN "crawlPattern" TEXT;

-- Crawl progress tracking
ALTER TABLE "application_documents" ADD COLUMN "pagesDiscovered" INTEGER;
ALTER TABLE "application_documents" ADD COLUMN "pagesCrawled" INTEGER;

-- API documentation metrics
ALTER TABLE "application_documents" ADD COLUMN "endpointsFound" INTEGER;
