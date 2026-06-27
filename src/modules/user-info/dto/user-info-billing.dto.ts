import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsEmail,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';

export class CreatePersonaNaturalBillingDto {
  @ApiProperty({ description: 'Tipo de documento', enum: ['CC', 'CE', 'PA', 'NIT'] })
  @IsNotEmpty()
  @IsEnum(['CC', 'CE', 'PA', 'NIT'])
  tipoDocumento: string;

  @ApiProperty({ description: 'Número de documento de identificación' })
  @IsNotEmpty()
  @IsString()
  numeroDocumento: string;

  @ApiProperty({ description: 'Primer nombre' })
  @IsNotEmpty()
  @IsString()
  primerNombre: string;

  @ApiProperty({ description: 'Primer apellido' })
  @IsNotEmpty()
  @IsString()
  primerApellido: string;

  @ApiProperty({ description: 'Nacionalidad de la persona', enum: ['Nacional', 'Extranjero'] })
  @IsNotEmpty()
  @IsEnum(['Nacional', 'Extranjero'])
  tipoPersonaNacionalidad: string;

  @ApiProperty({ description: 'Responsabilidades fiscales RUT (separadas por comas)' })
  @IsNotEmpty()
  @IsString()
  responsabilidadesFiscales: string;

  @ApiProperty({ description: 'Régimen tributario', enum: ['Régimen Común', 'Régimen Simple de Tributación', 'No responsable de IVA'] })
  @IsNotEmpty()
  @IsEnum(['Régimen Común', 'Régimen Simple de Tributación', 'No responsable de IVA'])
  regimenTributario: string;

  @ApiProperty({ description: 'Régimen fiscal del IVA', enum: ['Responsable de IVA', 'No responsable de IVA'] })
  @IsNotEmpty()
  @IsEnum(['Responsable de IVA', 'No responsable de IVA'])
  regimenFiscalIva: string;

  @ApiProperty({ description: 'Correo electrónico registrado en el RUT' })
  @IsNotEmpty()
  @IsEmail()
  correoElectronicoRut: string;

  @ApiProperty({ description: 'Dirección física de domicilio fiscal' })
  @IsNotEmpty()
  @IsString()
  direccion: string;

  @ApiProperty({ description: 'Departamento' })
  @IsNotEmpty()
  @IsString()
  departamento: string;

  @ApiProperty({ description: 'Municipio / Ciudad' })
  @IsNotEmpty()
  @IsString()
  municipio: string;

  @ApiProperty({ description: 'Certificado de firma digital (ruta, URL o base64)' })
  @IsNotEmpty()
  @IsString()
  certificadoFirma: string;

  @ApiProperty({ description: 'Modo de operación software de facturación', enum: ['Proveedor Tecnológico', 'Desarrollo Propio', 'Facturación Gratuita DIAN'] })
  @IsNotEmpty()
  @IsEnum(['Proveedor Tecnológico', 'Desarrollo Propio', 'Facturación Gratuita DIAN'])
  modoOperacion: string;

  @ApiProperty({ description: 'Prefijo de facturación autorizado' })
  @IsNotEmpty()
  @IsString()
  prefijoNumeracion: string;

  @ApiProperty({ description: 'Consecutivo inicial del rango autorizado' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  rangoDesde: number;

  @ApiProperty({ description: 'Consecutivo final del rango autorizado' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  rangoHasta: number;

  @ApiProperty({ description: 'Número de resolución oficial DIAN' })
  @IsNotEmpty()
  @IsString()
  resolucionDian: string;

  @ApiProperty({ description: 'Fecha de expedición de la resolución' })
  @IsNotEmpty()
  @IsDateString()
  fechaResolucion: string;

  @ApiProperty({ description: 'Fecha de vencimiento de la resolución' })
  @IsNotEmpty()
  @IsDateString()
  fechaVigencia: string;
}

export class CreatePersonaJuridicaBillingDto {
  @ApiProperty({ description: 'Tipo de documento', enum: ['NIT'] })
  @IsNotEmpty()
  @IsEnum(['NIT'])
  tipoDocumento: string;

  @ApiProperty({ description: 'Número de NIT sin dígito de verificación' })
  @IsNotEmpty()
  @IsString()
  numeroNit: string;

  @ApiProperty({ description: 'Dígito de verificación NIT' })
  @IsNotEmpty()
  @IsString()
  digitoVerificacion: string;

  @ApiProperty({ description: 'Razón social legal' })
  @IsNotEmpty()
  @IsString()
  razonSocial: string;

  @ApiProperty({ description: 'Tipo de organización jurídica', enum: ['S.A.S.', 'S.A.', 'Ltda.', 'Cooperativa', 'Fundación', 'ESAL', 'Otra'] })
  @IsNotEmpty()
  @IsEnum(['S.A.S.', 'S.A.', 'Ltda.', 'Cooperativa', 'Fundación', 'ESAL', 'Otra'])
  tipoOrganizacion: string;

  @ApiProperty({ description: 'Código CIIU de actividad económica principal' })
  @IsNotEmpty()
  @IsString()
  codigoCiiu: string;

  @ApiProperty({ description: 'Tipo de documento representante legal', enum: ['CC', 'CE', 'PA'] })
  @IsNotEmpty()
  @IsEnum(['CC', 'CE', 'PA'])
  repLegalTipoDoc: string;

  @ApiProperty({ description: 'Número de documento representante legal' })
  @IsNotEmpty()
  @IsString()
  repLegalNumeroDoc: string;

  @ApiProperty({ description: 'Nombres representante legal' })
  @IsNotEmpty()
  @IsString()
  repLegalNombres: string;

  @ApiProperty({ description: 'Apellidos representante legal' })
  @IsNotEmpty()
  @IsString()
  repLegalApellidos: string;

  @ApiProperty({ description: 'Correo electrónico representante legal' })
  @IsNotEmpty()
  @IsEmail()
  repLegalEmail: string;

  @ApiProperty({ description: 'Responsabilidades fiscales RUT (separadas por comas)' })
  @IsNotEmpty()
  @IsString()
  responsabilidadesFiscales: string;

  @ApiProperty({ description: 'Régimen tributario', enum: ['Régimen Ordinario', 'Régimen Simple de Tributación'] })
  @IsNotEmpty()
  @IsEnum(['Régimen Ordinario', 'Régimen Simple de Tributación'])
  regimenTributario: string;

  @ApiProperty({ description: 'Régimen fiscal del IVA', enum: ['Responsable de IVA', 'No responsable de IVA'] })
  @IsNotEmpty()
  @IsEnum(['Responsable de IVA', 'No responsable de IVA'])
  regimenFiscalIva: string;

  @ApiProperty({ description: 'Correo electrónico registrado en el RUT de la empresa' })
  @IsNotEmpty()
  @IsEmail()
  correoElectronicoRut: string;

  @ApiProperty({ description: 'Dirección física del domicilio fiscal' })
  @IsNotEmpty()
  @IsString()
  direccion: string;

  @ApiProperty({ description: 'Departamento' })
  @IsNotEmpty()
  @IsString()
  departamento: string;

  @ApiProperty({ description: 'Municipio / Ciudad' })
  @IsNotEmpty()
  @IsString()
  municipio: string;

  @ApiProperty({ description: 'Certificado de firma digital (ruta, URL o base64)' })
  @IsNotEmpty()
  @IsString()
  certificadoFirma: string;

  @ApiProperty({ description: 'Modo de operación software de facturación', enum: ['Proveedor Tecnológico', 'Desarrollo Propio', 'Facturación Gratuita DIAN'] })
  @IsNotEmpty()
  @IsEnum(['Proveedor Tecnológico', 'Desarrollo Propio', 'Facturación Gratuita DIAN'])
  modoOperacion: string;

  @ApiProperty({ description: 'Prefijo de facturación autorizado' })
  @IsNotEmpty()
  @IsString()
  prefijoNumeracion: string;

  @ApiProperty({ description: 'Consecutivo inicial del rango autorizado' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  rangoDesde: number;

  @ApiProperty({ description: 'Consecutivo final del rango autorizado' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  rangoHasta: number;

  @ApiProperty({ description: 'Número de resolución oficial DIAN' })
  @IsNotEmpty()
  @IsString()
  resolucionDian: string;

  @ApiProperty({ description: 'Fecha de expedición de la resolución' })
  @IsNotEmpty()
  @IsDateString()
  fechaResolucion: string;

  @ApiProperty({ description: 'Fecha de vencimiento de la resolución' })
  @IsNotEmpty()
  @IsDateString()
  fechaVigencia: string;
}
