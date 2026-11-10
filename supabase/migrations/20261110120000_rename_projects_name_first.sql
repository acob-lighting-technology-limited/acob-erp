-- Project names lead with the community or client, not the size and type,
-- so lists across the ERP read "Adebayo — 100kWp Hybrid Solar Mini-Grid".
-- Size and type also live in capacity_w and technology_type.
--
-- Applied to production on 2026-11-10 with the user's approval. Idempotent:
-- each row matches on its old name only, so a re-run changes nothing.
-- Every other table refers to projects by id; requisitions keep a text copy,
-- which is renamed alongside.

WITH renames(old_name, new_name) AS (
  VALUES
    ('100kWp HYBRID SOLAR MINI-GRID - ADEBAYO', 'Adebayo — 100kWp Hybrid Solar Mini-Grid'),
    ('100kWp HYBRID SOLAR MINI-GRID - OLOOJI', 'Olooji — 100kWp Hybrid Solar Mini-Grid'),
    ('100kWp HYBRID SOLAR MINI-GRID - OLOYAN', 'Oloyan — 100kWp Hybrid Solar Mini-Grid'),
    ('100kWp HYBRID SOLAR MINI-GRID - ONIPANU', 'Onipanu — 100kWp Hybrid Solar Mini-Grid'),
    ('1155KWp INTERCONNECTED MINI-GRID ELECTRIFICATION OF MARARABA UDEGE', 'Mararaba Udege — 1155kWp Interconnected Mini-Grid'),
    ('150kWp HYBRID SOLAR MINI-GRID - KYAKALE', 'Kyakale — 150kWp Hybrid Solar Mini-Grid'),
    ('150kWp HYBRID SOLAR MINI-GRID - MUSHA', 'Musha — 150kWp Hybrid Solar Mini-Grid'),
    ('1MWp INTERCONNECTED MINI-GRID ELECTRIFICATION OF UMAISHA COMMUNITY', 'Umaisha — 1MWp Interconnected Mini-Grid'),
    ('200kWp HYBRID SOLAR MINI-GRID - OGUFA', 'Ogufa — 200kWp Hybrid Solar Mini-Grid'),
    ('250units SHS DEPLOYMENT ACROSS NASARAWA & ABIA STATE, & FCT', 'Nasarawa, Abia & FCT — 250-Unit SHS Deployment'),
    ('300kWp HYBRID SOLAR MINI-GRID - TUNGA', 'Tunga — 300kWp Hybrid Solar Mini-Grid'),
    ('320kWp CITIBANK PROJECT', 'Citibank — 320kWp Project'),
    ('350kWp HYBRID SOLAR MINI-GRID - UMAISHA (ISOLATED)', 'Umaisha (Isolated) — 350kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - AJEGUNLE', 'Ajegunle — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - AYETORO', 'Ayetoro — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - BOLORUNDURO ADAJA', 'Bolorunduro Adaja — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - BOLORUNDURO ADEWOLE', 'Bolorunduro Adewole — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - BONDU', 'Bondu — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - ERINLA', 'Erinla — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - OBADORE', 'Obadore — 40kWp Hybrid Solar Mini-Grid'),
    ('40kWp HYBRID SOLAR MINI-GRID - OROTEDO', 'Orotedo — 40kWp Hybrid Solar Mini-Grid'),
    ('50kWp HYBRID SOLAR MINI-GRID - MAKAMI', 'Makami — 50kWp Hybrid Solar Mini-Grid'),
    ('50kWp HYBRID SOLAR MINI-GRID - MILE 9', 'Mile 9 — 50kWp Hybrid Solar Mini-Grid'),
    ('50KWp ISOLATED MINI-GRID ELECTRIFICATION (AMP) - AWBA OFEMMILI', 'Awba Ofemmili — 50kWp Isolated Mini-Grid (AMP)'),
    ('50KWp ISOLATED MINI-GRID ELECTRIFICATION (AMP) - BUTUBUTU', 'Butubutu — 50kWp Isolated Mini-Grid (AMP)'),
    ('50KWp MICRO-GRID / BUILDING CONSTRUCTIONS AT NADDC OWERRI', 'NADDC Owerri — 50kWp Micro-Grid & Building Construction'),
    ('600KWp ISOLATED MINI-GRID ELECTRIFICATION OF 10 KADUNA SITES', 'Kaduna (10 sites) — 600kWp Isolated Mini-Grid'),
    ('60kWp HYBRID SOLAR MINI-GRID - MILE 13 COMMUNITY', 'Mile 13 — 60kWp Hybrid Solar Mini-Grid'),
    ('60kWp HYBRID SOLAR MINI-GRID - SULE ABA-PANU', 'Sule Aba-Panu — 60kWp Hybrid Solar Mini-Grid'),
    ('64KWp MICRO-GRID AT ECOFITNESS', 'Ecofitness — 64kWp Micro-Grid'),
    ('70kWp HYBRID SOLAR MINI-GRID - ASEJIRE', 'Asejire — 70kWp Hybrid Solar Mini-Grid'),
    ('70kWp HYBRID SOLAR MINI-GRID - OTU-COSTAIN', 'Otu-Costain — 70kWp Hybrid Solar Mini-Grid'),
    ('990KWp INTERCONNECTED MINI-GRID ELECTRIFICATION OF JENGRE', 'Jengre — 990kWp Interconnected Mini-Grid')
),
renamed_projects AS (
  UPDATE public.projects p
  SET project_name = r.new_name, updated_at = now()
  FROM renames r
  WHERE p.project_name = r.old_name
  RETURNING p.id
)
UPDATE public.requisitions q
SET project_name = r.new_name
FROM renames r
WHERE q.project_name = r.old_name;
