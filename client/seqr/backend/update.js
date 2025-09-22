import { global } from "./global.js";
import { AutoScroll } from "./DOM/auto-scroll.js";
import { SetupButtonPlus } from "./DOM/button-plus.js";
import { CoverEventHandler } from "./DOM/cover.js";
import { DisableButtons } from "./DOM/disable-buttons.js";
import { SetupNumberPlus } from "./DOM/number-plus.js";
import { SliderTrackEventHandler, SliderValueEventHandler } from "./DOM/slider.js";
import { RadioEventHandler, ToggleEventHandler } from "./DOM/togglers.js";
import { AspectRatioInputEventHandler, AspectRatioPresetEventHandler } from "./event-handlers/aspect-ratio.js";
import { DeleteFilesEventHandler } from "./event-handlers/delete-files.js";
import { ImportEventHandler, ImportFileEventHandler, FileEditorNameEventHandler, FileEditorSaveEventHandler, ImportDragAndDropEventHandler } from "./event-handlers/import.js";
import { MultiselectEventHandler } from "./event-handlers/multiselect.js";
import { ViewFilesDeleteEventHandler, ViewFilesEventHandler, ViewFilesTabEventHandler } from "./event-handlers/view-files.js";
import { ViewRangeEventHandler, ViewRangeInputsEventHandler } from "./event-handlers/view-range.js";
import { UpdateColorSelector } from "./function/color-selector.js";
import { ReadFile } from "./function/file/read.js";
import { GroupsResizeEventHandler } from "./function/groups-resize.js";
import { MoveGroup, NewGroup } from "./function/groups/main.js";
import { SwitchTheme } from "./function/theme.js";
import { MainUndoRedo } from "./function/undo-redo/instance.js";
import { UniqueName } from "./function/unique-name.js";
import { UpdateRenderSettings } from "./function/update-render-settings.js";
import { AutoGroupEventHandler, DeleteGroupsEventHandler, NewGroupEventHandler, CleanGroupsEventHandler } from "./event-handlers/groups.js";
import { LocatorEventHandler } from "./event-handlers/locator.js";
import { Follower } from "../../module/follower.js";
import { DeleteGroupEventHandler, EditGroupEventHandler, MoveGroupEventHandler } from "./event-handlers/group.js";
import { DataSelectorSaveEventHandler, DataSelectorTabEventHandler, DataSelectorToggleEventHandler } from "./event-handlers/data-selector.js";
import { DeleteMemberEventHandler } from "./event-handlers/member.js";
import { SetupOSX } from "./DOM/osx.js";

const $tutorial = document.querySelector("#tutorial");
function update() {
    document.querySelectorAll("[data-event]").forEach($el => {
        const events = $el.dataset.event.split(",");
        for (const event of events) {
            switch (event) {
                case "radio": {
                    RadioEventHandler($el);
                } break;
                case "toggle": {
                    ToggleEventHandler($el);
                } break;
                case "multiselect": {
                    MultiselectEventHandler($el);
                } break;

                case "slider:track": {
                    SliderTrackEventHandler($el);
                } break;
                case "slider:value": {
                    SliderValueEventHandler($el);
                } break;

                case "cover": {
                    CoverEventHandler($el);
                } break;

                case "switch-theme": {
                    $el.addEventListener("click", SwitchTheme);
                } break;

                case "locator": {
                    LocatorEventHandler($el);
                } break;

                case "help": {
                    const $tutorial = document.querySelector("#tutorial");
                    $el.addEventListener("click", e => {
                        $tutorial.classList.remove("minimize");
                    });
                } break;

                case "import": {
                    ImportEventHandler($el);
                } break;
                case "import:file": {
                    ImportFileEventHandler($el);
                } break;
                case "import:drag-and-drop": {
                    ImportDragAndDropEventHandler($el);
                } break;
                case "file-editor:name": {
                    FileEditorNameEventHandler($el);
                } break;
                case "file-editor:save": {
                    FileEditorSaveEventHandler($el);
                } break;

                case "files:delete": {
                    DeleteFilesEventHandler($el);
                } break;

                case "files:view": {
                    ViewFilesEventHandler($el);
                } break;
                case "file-viewer:tab": {
                    ViewFilesTabEventHandler($el);
                } break;
                case "file-viewer:delete": {
                    ViewFilesDeleteEventHandler($el);
                } break;

                case "groups:toggle": {
                    $el.addEventListener("click", () => document.documentElement.querySelector("#groups").classList.toggle("collapsed"));
                } break;
                case "groups:resize": {
                    GroupsResizeEventHandler($el);
                } break;
                case "groups:new": {
                    NewGroupEventHandler($el);
                } break;
                case "groups:auto": {
                    AutoGroupEventHandler($el);
                } break;
                case "groups:clean": {
                    CleanGroupsEventHandler($el);
                } break;
                case "groups:delete": {
                    DeleteGroupsEventHandler($el);
                } break;

                case "group:edit": {
                    EditGroupEventHandler($el);
                } break;
                case "data-selector:tab": {
                    DataSelectorTabEventHandler($el);
                } break;
                case "data-selector:toggle": {
                    DataSelectorToggleEventHandler($el);
                } break;
                case "data-selector:save": {
                    DataSelectorSaveEventHandler($el);
                } break;

                case "group:delete": {
                    DeleteGroupEventHandler($el);
                } break;
                case "group:move:top": {
                    MoveGroupEventHandler($el, 0n);
                } break;
                case "group:move:up": {
                    MoveGroupEventHandler($el, -1);
                } break;
                case "group:move:down": {
                    MoveGroupEventHandler($el, 1);
                } break;
                case "group:move:bottom": {
                    MoveGroupEventHandler($el, -1n);
                } break;

                case "member:delete": {
                    DeleteMemberEventHandler($el);
                } break;

                case "render-settings:view-range": {
                    ViewRangeEventHandler($el);
                } break;
                case "render-settings:min": {
                    ViewRangeInputsEventHandler($el, "min");
                } break;
                case "render-settings:max": {
                    ViewRangeInputsEventHandler($el, "max");
                } break;

                case "render-settings:update-text(click)": {
                    $el.addEventListener("click", e => {
                        UpdateRenderSettings();
                    });
                } break;
                case "render-settings:update-text(change)": {
                    $el.addEventListener("change", e => {
                        UpdateRenderSettings();
                    });
                } break;

                case "render-settings:aspect-ratio:width": {
                    AspectRatioInputEventHandler($el);
                } break;
                case "render-settings:aspect-ratio:height": {
                    AspectRatioInputEventHandler($el);
                } break;
                case "render-settings:aspect-ratio:preset": {
                    AspectRatioPresetEventHandler($el);
                } break;

                case "render-settings:background": {
                    const $preview = $el.closest(".content").querySelector(":scope > .preview");
                    $el.addEventListener("change", e => {
                        const v = $el.value || $el.placeHolder;
                        if (CSS.supports("background", v)) {
                            $preview.style.background = v;
                        } else {
                            $preview.style.background = "";
                        }
                    });
                } break;
            }
        }

        delete $el.dataset.event;
    });

    SetupOSX();
    SetupButtonPlus();
    SetupNumberPlus();

    AutoScroll();
    DisableButtons();
    $tutorial.classList.toggle("hidden", global.hasRendered ?? false);

    test(); // EXPERIMENT

    window.requestAnimationFrame(update);
}
window.requestAnimationFrame(update);

let done = false;
function test() { /* EXPERIMENT */
    if (window.location.hash === "#test") {
        if (done) return;
        done = true;

        const build = (name, txt) => {
            const file = new File(
                [ new Blob([ txt ], { type: "text/plain" }) ],
                name,
                { type: "text/plain", lastModified: Date.now() }
            );

            ReadFile(file)
                .catch(res => console.error(`Failed to load text file: ${name} - ${res.error}`));
        }

        build(
            "showcase_gff.gff3",
`##gff-version 3
chr1	Ensembl	gene	1000	5000	.	+	.	ID=gene1;Name=ExampleGene
chr1	Ensembl	mRNA	1000	5000	.	+	.	ID=transcript1;Parent=gene1;Name=TranscriptA
chr1	Ensembl	exon	1000	1200	.	+	.	ID=exon1;Parent=transcript1
chr1	Ensembl	CDS	1050	1200	.	+	0	ID=cds1;Parent=transcript1
chr1	Ensembl	UTR	1000	1049	.	+	.	ID=utr1;Parent=transcript1

chr1	Ensembl	exon	1300	1500	.	+	.	ID=exon2;Parent=transcript1
chr1	Ensembl	CDS	1300	1500	.	+	0	ID=cds2;Parent=transcript1

chr1	Ensembl	exon	2000	2500	.	+	.	ID=exon3;Parent=transcript1
chr1	Ensembl	CDS	2000	2400	.	+	2	ID=cds3;Parent=transcript1
chr1	Ensembl	UTR	2401	2500	.	+	.	ID=utr2;Parent=transcript1

chr1	Ensembl	mRNA	1000	2600	.	+	.	ID=transcript2;Parent=gene1;Name=TranscriptB
chr1	Ensembl	exon	1000	1200	.	+	.	ID=exon4;Parent=transcript2
chr1	Ensembl	CDS	1100	1200	.	+	0	ID=cds4;Parent=transcript2

chr1	Ensembl	exon	1400	1600	.	+	.	ID=exon5;Parent=transcript2
chr1	Ensembl	CDS	1400	1600	.	+	0	ID=cds5;Parent=transcript2

chr1	Ensembl	exon	2600	3000	.	+	.	ID=exon6;Parent=transcript2
chr1	Ensembl	CDS	2600	2900	.	+	0	ID=cds6;Parent=transcript2
chr1	Ensembl	UTR	2901	3000	.	+	.	ID=utr3;Parent=transcript2`
        );

        build(
            "showcase_gff.gff3",
`##gff-version 3
chr1	Ensembl	gene	1000	5000	.	+	.	ID=gene1;Name=ExampleGene
chr1	Ensembl	mRNA	1000	5000	.	+	.	ID=transcript1;Parent=gene1;Name=TranscriptA
chr1	Ensembl	exon	1000	1200	.	+	.	ID=exon1;Parent=transcript1
chr1	Ensembl	CDS	1050	1200	.	+	0	ID=cds1;Parent=transcript1
chr1	Ensembl	UTR	1000	1049	.	+	.	ID=utr1;Parent=transcript1

chr1	Ensembl	exon	1300	1500	.	+	.	ID=exon2;Parent=transcript1
chr1	Ensembl	CDS	1300	1500	.	+	0	ID=cds2;Parent=transcript1

chr1	Ensembl	exon	2000	2500	.	+	.	ID=exon3;Parent=transcript1
chr1	Ensembl	CDS	2000	2400	.	+	2	ID=cds3;Parent=transcript1
chr1	Ensembl	UTR	2401	2500	.	+	.	ID=utr2;Parent=transcript1

chr1	Ensembl	mRNA	1000	2600	.	+	.	ID=transcript2;Parent=gene1;Name=TranscriptB
chr1	Ensembl	exon	1000	1200	.	+	.	ID=exon4;Parent=transcript2
chr1	Ensembl	CDS	1100	1200	.	+	0	ID=cds4;Parent=transcript2

chr1	Ensembl	exon	1400	1600	.	+	.	ID=exon5;Parent=transcript2
chr1	Ensembl	CDS	1400	1600	.	+	0	ID=cds5;Parent=transcript2

chr1	Ensembl	exon	2600	3000	.	+	.	ID=exon6;Parent=transcript2
chr1	Ensembl	CDS	2600	2900	.	+	0	ID=cds6;Parent=transcript2
chr1	Ensembl	UTR	2901	3000	.	+	.	ID=utr3;Parent=transcript2`
        );

        /* build(
            "showcase_bed.bed",
`chr1	999	5000	gene1_transcript1	0	+	1050	2400	0,0,255	3	201,201,501	0,300,1000
chr1	999	3000	gene1_transcript2	0	+	1100	2900	0,128,0	3	201,201,400	0,400,1600
chr1	1000	4000	gene2_transcript1	0	-	1200	3800	255,0,0	2	500,600	0,2400
chr1	1500	4200	gene2_transcript2	0	-	1600	4000	255,165,0	3	300,400,500	0,900,2100`
        );

        build(
            "showcase_gtf.gtf",
`##gtf-version 2.5
##genome-build GRCh38
##annotation-source Ensembl
chr1	Ensembl	gene	1000	5000	.	+	.	gene_id "ENSG00000001"; gene_name "EXAMPLE1"; gene_biotype "protein_coding";
chr1	Ensembl	transcript	1000	5000	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; transcript_name "EXAMPLE1-001"; transcript_biotype "protein_coding";
chr1	Ensembl	exon	1000	1200	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "1"; exon_id "ENSE00000001";
chr1	Ensembl	CDS	1050	1200	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "1"; protein_id "ENSP00000001";
chr1	Ensembl	start_codon	1050	1052	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "1";
chr1	Ensembl	exon	1400	1600	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "2"; exon_id "ENSE00000002";
chr1	Ensembl	CDS	1400	1600	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "2"; protein_id "ENSP00000001";
chr1	Ensembl	exon	2000	2500	.	+	.	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "3"; exon_id "ENSE00000003";
chr1	Ensembl	CDS	2000	2400	.	+	2	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "3"; protein_id "ENSP00000001";
chr1	Ensembl	stop_codon	2401	2403	.	+	0	gene_id "ENSG00000001"; transcript_id "ENST00000001"; exon_number "3";`
        );

        build(
            "showcase_vcf.vcf",
`##fileformat=VCFv4.3
##reference=GRCh38
##contig=<ID=chr1,length=248956422>
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read Depth">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	Sample1
chr1	1500	rs123456	A	G	60	PASS	DP=30;AF=0.5	GT:DP	0/1:25
chr1	2200	.	C	T	45	PASS	DP=20;AF=0.3	GT:DP	0/1:18
chr1	3800	rs789012	G	A,C	80	PASS	DP=40;AF=0.4,0.1	GT:DP	1/2:35
chr1	4500	.	ATCG	A	35	PASS	DP=15;AF=0.6	GT:DP	1/1:12`
        );

        build(
            "showcase_bedgraph.bedgraph",
`track type=bedGraph name="Coverage Signal" description="Sequencing coverage depth"
chr1	1000	1100	15.5
chr1	1100	1200	22.3
chr1	1200	1400	18.7
chr1	1400	1600	45.2
chr1	1600	1800	38.9
chr1	1800	2000	12.1
chr1	2000	2200	55.8
chr1	2200	2400	67.3
chr1	2400	2600	42.6
chr1	2600	2800	29.4
chr1	2800	3000	33.7
chr1	3000	3200	51.2
chr1	3200	3400	28.8
chr1	3400	3600	41.5
chr1	3600	3800	36.2
chr1	3800	4000	19.6
chr1	4000	4200	24.3
chr1	4200	4400	47.9
chr1	4400	4600	52.1
chr1	4600	4800	31.8
chr1	4800	5000	26.7`
        );

        build(
            "showcase_sam.sam",
`@HD	VN:1.6	SO:coordinate
@SQ	SN:chr1	LN:248956422
@RG	ID:sample1	SM:sample1	PL:ILLUMINA
@PG	ID:bwa	PN:bwa	VN:0.7.17
read001	99	chr1	1150	60	100M	=	1350	300	ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
read002	147	chr1	1350	60	100M	=	1150	-300	TGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCA	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
read003	0	chr1	2100	60	75M25S	*	0	0	GGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCATCGATCGATCGATCGATCG	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII#####################
read004	16	chr1	2300	55	50M50H	*	0	0	AAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGG	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
read005	0	chr1	3500	60	100M	*	0	0	CGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAT	IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII`
        );

        build(
            "showcase_fasta.fasta",
`>chr1:1000-2000 example genomic sequence
ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCT
TATATATATATATATATATATATATATATATATATATATATATATATA
CGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCG
AAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAA
TTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTT
ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTAC
TGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATGCATG
GGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGG
CCTTAACCCCTTAACCCCTTAACCCCTTAACCCCTTAACCCCTTAACCCC
AAAAGGGGCCCCTTTTAAAAGGGGCCCCTTTTAAAAGGGGCCCCTTTTAA
TTTTAAAACCCCGGGGTTTTAAAACCCCGGGGTTTTAAAACCCCGGGGTT
GGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGG
CCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCC
AAAATTTTGGGGCCCCAAAATTTTGGGGCCCCAAAATTTTGGGGCCCCAA
TTTTCCCCAAAATTTTCCCCAAAATTTTCCCCAAAATTTTCCCCAAAATT
GGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGGCCAAGG
AACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAACCTTGGAA
TTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATT
CCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCC
>gene_region exon sequence with coding potential
ATGTCCAAAGGTCCTGAGTTTGACCCTAAGAAGTCTATCGGCCTGGACC
TGCTGAAGGACCTGTTTGACAAGATGGCCAAGGTGGACCCTGAGGTGAA
GTTCGACAAGTCCAAGGACCTGAAAGAGAAGATGCTGTCCAAGCTGCTG
GACAAGAAGGTGGACCCTGAGGTGAAGTTCGACAAGTCCAAGGACCTGA
AAGAGAAGATGCTGTCCAAGCTGCTGGACAAGAAGGTGGACCCTGAGGT
GAAGTTCGACAAGTCCAAGGACCTGAAAGAGAAGATGCTGTCCAAGCTG
CTGGACAAGAAGGTGGACCCTGAGGTGAAGTTCGACAAGTCCAAGGACC
TGAAAGAGAAGATGCTGTCCAAGCTGCTGGACAAGAAGGTGGACCCTGA
GGTGAAGTTCGACAAGTCCAAGGACCTGAAAGAGAAGATGCTGTCCAAG
CTGCTGGACAAGAAGGTGGACCCTGAGGTGAAGTTCGACAAGTCCAAGG
ACCTGAAAGAGAAGATGCTGTCCAAGCTGCTGGACAAGAAGTAG`
        ); */
    }
}