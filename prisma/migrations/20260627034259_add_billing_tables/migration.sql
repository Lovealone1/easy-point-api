-- CreateTable
CREATE TABLE "persona_natural_billing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "primerNombre" TEXT NOT NULL,
    "primerApellido" TEXT NOT NULL,
    "tipoPersonaNacionalidad" TEXT NOT NULL,
    "responsabilidadesFiscales" TEXT NOT NULL,
    "regimenTributario" TEXT NOT NULL,
    "regimenFiscalIva" TEXT NOT NULL,
    "correoElectronicoRut" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "certificadoFirma" TEXT NOT NULL,
    "modoOperacion" TEXT NOT NULL,
    "prefijoNumeracion" TEXT NOT NULL,
    "rangoDesde" INTEGER NOT NULL,
    "rangoHasta" INTEGER NOT NULL,
    "resolucionDian" TEXT NOT NULL,
    "fechaResolucion" TIMESTAMP(3) NOT NULL,
    "fechaVigencia" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_natural_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_juridica_billing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroNit" TEXT NOT NULL,
    "digitoVerificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "tipoOrganizacion" TEXT NOT NULL,
    "codigoCiiu" TEXT NOT NULL,
    "repLegalTipoDoc" TEXT NOT NULL,
    "repLegalNumeroDoc" TEXT NOT NULL,
    "repLegalNombres" TEXT NOT NULL,
    "repLegalApellidos" TEXT NOT NULL,
    "repLegalEmail" TEXT NOT NULL,
    "responsabilidadesFiscales" TEXT NOT NULL,
    "regimenTributario" TEXT NOT NULL,
    "regimenFiscalIva" TEXT NOT NULL,
    "correoElectronicoRut" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "certificadoFirma" TEXT NOT NULL,
    "modoOperacion" TEXT NOT NULL,
    "prefijoNumeracion" TEXT NOT NULL,
    "rangoDesde" INTEGER NOT NULL,
    "rangoHasta" INTEGER NOT NULL,
    "resolucionDian" TEXT NOT NULL,
    "fechaResolucion" TIMESTAMP(3) NOT NULL,
    "fechaVigencia" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_juridica_billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persona_natural_billing_userId_key" ON "persona_natural_billing"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "persona_juridica_billing_userId_key" ON "persona_juridica_billing"("userId");

-- AddForeignKey
ALTER TABLE "persona_natural_billing" ADD CONSTRAINT "persona_natural_billing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_juridica_billing" ADD CONSTRAINT "persona_juridica_billing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
