from __future__ import annotations

from typing import Optional
from app.models.schemas import (
    DocumentArtifact,
    DocumentClause,
    DocumentPage,
    OcrBoundingBox,
)


def build_uploaded_artifact(
    case_id: str,
    idx: int,
    file_name: str,
    sha256: str,
    stored_file_path: Optional[str] = None,
) -> DocumentArtifact:
    """Leptos OCR v2.8 spatial extraction stub producing [x, y, w, h] & [x1, y1, x2, y2] boxes."""
    x, y, w, h = 120, 210, 410, 38
    bbox = OcrBoundingBox(
        id=f"bbox-{case_id}-{idx}-1",
        label="Box #1: Extracted Corporate Header",
        clauseTitle="INCORPORATION & ENTITY HEADER",
        extractedText=f"{file_name} — SHA-256 {sha256[:16]}...",
        coords=[x, y, w, h],
        bboxCorners=[x, y, x + w, y + h],
        confidencePct=98.5,
        status="VERIFIED",
    )
    return DocumentArtifact(
        id=f"DOC-{case_id}-{idx + 1}",
        fileName=file_name,
        fileType="XML" if file_name.lower().endswith(".xml") else "PDF",
        pageCount=12,
        currentPage=1,
        sha256=sha256,
        ocrConfidencePct=98.5,
        ocrModel="LayoutLMv3-Inst",
        status="EXTRACTED",
        storedFilePath=stored_file_path,
        analystAnnotation="Uploaded via Intake Dropzone; OCR bounding regions indexed.",
        annotatedBy="Leptos OCR v2.8",
        boundingBoxes=[bbox],
        pages=[
            DocumentPage(
                pageNumber=1,
                headerLeft="PROJECT NORTHGATE • INGESTED ARTIFACT",
                headerRight="PAGE 1 OF 12 [OCR INDEXED]",
                documentTitle=file_name.upper(),
                subtitle=f"CASE {case_id}",
                regMeta=f"SHA-256: {sha256}",
                clauses=[
                    DocumentClause(
                        heading="CLAUSE 1 — AUTOMATED OCR EXTRACTION SUMMARY",
                        body=(
                            f"Document '{file_name}' ingested cleanly into FedRAMP High enclave storage "
                            f"with cryptographic checksum {sha256}."
                        ),
                        bboxId=bbox.id,
                    )
                ],
            )
        ],
    )


def extract_spatial_regions(documents: list[DocumentArtifact]) -> list[dict]:
    """Return normalized bounding boxes (both xywh and x1y1x2y2) for agentic workflow consumption."""
    regions: list[dict] = []
    for doc in documents:
        for box in doc.boundingBoxes:
            x, y, w, h = box.coords
            regions.append(
                {
                    "documentId": doc.id,
                    "fileName": doc.fileName,
                    "bboxId": box.id,
                    "clauseTitle": box.clauseTitle,
                    "extractedText": box.extractedText,
                    "xywh": [x, y, w, h],
                    "x1y1x2y2": box.bboxCorners or [x, y, x + w, y + h],
                    "confidencePct": box.confidencePct,
                    "status": box.status,
                }
            )
    return regions
