import { supabase } from "./supabase.js";

// Variables globales
let professionals = [];
let currentPage = 1;
let recordsPerPage = 10;
let filteredProfessionals = [];
let digitalCertificateOnly = false;
const googleMapsApiKey = 'AIzaSyAyjnRLusJVkSsiJyssRPK2L6CB3hD1gN8';

// Llama a la función initMap cuando se necesita mostrar el mapa
function showMap(address) {
    var geocoder = new google.maps.Geocoder();

    // Log para verificar la dirección

    geocoder.geocode({ 'address': address }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var lat = results[0].geometry.location.lat();
            var lng = results[0].geometry.location.lng();

            Swal.fire({
                title: 'Ubicación',
                html: `<div id="map-container" style="width: 100%; height: 300px;">
                           <iframe id="map" width="100%" height="100%" frameborder="0" style="border:0" allowfullscreen></iframe>
                       </div>`,
                confirmButtonText: 'Cerrar',
                didOpen: () => {
                    const mapIframe = document.getElementById('map');
                    if (mapIframe) {
                        mapIframe.src = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${lat},${lng}`;
                    }
                },
                customClass: {
                    popup: 'swal2-popup-custom',
                    title: 'swal2-title-custom',
                    htmlContainer: 'swal2-html-custom',
                }
            });
        } else {
            console.error('Geocode no tuvo éxito debido a: ' + status);
            Swal.fire('Error', 'No se pudo mostrar la ubicación en el mapa', 'error');
        }
    });
}

async function loadProfessionalsFromDB() {
    const { data, error } = await supabase
        .from('profesionales')
        .select(`
            *,
            categorias (
                nombre
            )
        `)
        .order('name');

    if (error) {
        console.error('Error cargando profesionales:', error);
        Swal.fire('Error', 'No se pudieron cargar los profesionales', 'error');
        return;
    }

    professionals = data;

    populateSpecialtyFilter();
    updateProfessionals();
}

// Función para actualizar la cantidad de registros por página
function updateRecordsPerPage() {
    recordsPerPage = parseInt(document.getElementById('recordsPerPage').value);
    currentPage = 1;
    updateProfessionals();
}

// Función para poblar el filtro de especialidades
function populateSpecialtyFilter() {
    const specialties = [
        ...new Set(
            professionals
                .map(p => p.categorias?.nombre)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    const specialtyFilter = document.getElementById('specialtyFilter');

    specialtyFilter.innerHTML =
        '<option value="all">TODAS LAS ESPECIALIDADES</option>';

    specialties.forEach(specialty => {
        const option = document.createElement('option');
        option.value = specialty;
        option.textContent = specialty;
        specialtyFilter.appendChild(option);
    });
}

// Función para actualizar los profesionales mostrados
function updateProfessionals() {
    const searchQuery = document.getElementById('search').value.toLowerCase();
    const selectedSpecialty = document.getElementById('specialtyFilter').value;

    filteredProfessionals = professionals.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchQuery)) &&
        (selectedSpecialty === 'all' ||
            p.categorias?.nombre === selectedSpecialty) &&
        (!digitalCertificateOnly ||
            p.certificado_medico_digital === true)
    );

    currentPage = 1;
    renderProfessionals();
    updatePaginationInfo();
}

// Función para renderizar los profesionales en la tabla

function renderProfessionals() {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const paginatedProfessionals = filteredProfessionals.slice(
        startIndex,
        startIndex + recordsPerPage
    );

    const professionalList = document.getElementById('professionalList');
    professionalList.innerHTML = '';

    paginatedProfessionals.forEach(professional => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${escapeHtml(professional.categorias?.nombre || '')}</td>
            <td>
                <span
                    class="professional-link"
                    role="button"
                    tabindex="0"
                    title="Tocá para ver los datos completos"
                >${escapeHtml(professional.name || '')}</span>

                ${professional.certificado_medico_digital === true
                    ? '<span class="digital-certificate-badge">✓ Certificado Médico Digital</span>'
                    : ''}
            </td>
            <td>${escapeHtml(professional.address || '')}</td>
            <td>${escapeHtml(professional.city || '')}</td>
            <td>${escapeHtml(professional.phone || '')}</td>
        `;

        const nameLink = row.querySelector('.professional-link');

        const openDetails = () => {
            if (window.innerWidth > 776) return;
            showProfessionalDetails(professional);
        };

        nameLink.addEventListener('click', openDetails);

        nameLink.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDetails();
            }
        });

        professionalList.appendChild(row);
    });

/*
Código original de ubicación, guardado temporalmente:

<td>
    <button class="map-button" data-address="${fullAddress}">
        <img src="img/maps.png" alt="Google Maps" width="40">
    </button>
</td>
*/

    /*document.querySelectorAll('.map-button').forEach(button => {
        button.addEventListener('click', function () {
            const address = this.getAttribute('data-address');
            showMap(address);
        });
    });

    if (window.innerWidth <= 776) {
        document.querySelectorAll('.professional-link').forEach(link => {
            link.addEventListener('click', function () {
                const specialty = this.parentElement.previousElementSibling.textContent;
                const address = this.parentElement.nextElementSibling.textContent;
                const city = this.parentElement.nextElementSibling.nextElementSibling.textContent;
                const phone = this.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.textContent;

                // Construye la dirección completa con la ciudad y el país para la versión móvil
                const fullAddress = `${address}, ${city}, Buenos Aires, Argentina`;

                const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(fullAddress)}`;

                Swal.fire({
                    icon: 'info',
                    title: this.textContent,
                    html: `
                        <p><strong>Especialidad:</strong> ${specialty}</p>
                        <p><strong>Dirección:</strong> ${address}</p>
                        <p><strong>Localidad:</strong> ${city}</p>
                        <p><strong>Teléfono:</strong> ${phone}</p>
                        <iframe id="map" width="100%" height="200" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>
                    `,
                    confirmButtonText: 'Cerrar',
                    customClass: {
                        popup: 'swal2-popup-custom',
                        title: 'swal2-title-custom',
                        htmlContainer: 'swal2-html-custom',
                    }
                });
            });
        });
    }*/
}


function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showProfessionalDetails(professional) {
    const specialty = professional.categorias?.nombre || 'No especificada';
    const name = professional.name || 'No informado';
    const address = professional.address || 'No informada';
    const city = professional.city || 'No informada';
    const phone = professional.phone || 'No informado';

    const digitalCertificate =
        professional.certificado_medico_digital === true;

    Swal.fire({
        icon: 'info',
        title: name,
        html: `
            <div class="professional-details-popup">
                <p>
                    <strong>Especialidad:</strong><br>
                    ${escapeHtml(specialty)}
                </p>

                <p>
                    <strong>Apellido y nombre:</strong><br>
                    ${escapeHtml(name)}
                </p>

                <p>
                    <strong>Dirección:</strong><br>
                    ${escapeHtml(address)}
                </p>

                <p>
                    <strong>Localidad:</strong><br>
                    ${escapeHtml(city)}
                </p>

                <p>
                    <strong>Teléfono:</strong><br>
                    ${escapeHtml(phone)}
                </p>

                ${digitalCertificate ? `
                    <p class="digital-certificate-badge">
                        ✓ Ofrece Certificado Médico Digital
                    </p>
                ` : ''}
            </div>
        `,
        confirmButtonText: 'Cerrar',
        customClass: {
            popup: 'swal2-popup-custom',
            title: 'swal2-title-custom',
            htmlContainer: 'swal2-html-custom'
        }
    });
}


// Función para actualizar la información de paginación
function updatePaginationInfo() {
    const pageInfo = document.getElementById('pageInfo');
    pageInfo.textContent = `Página ${currentPage} de ${Math.ceil(filteredProfessionals.length / recordsPerPage)}`;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === Math.ceil(filteredProfessionals.length / recordsPerPage);
}

// Función para cambiar de página
function changePage(direction) {
    currentPage += direction;
    renderProfessionals();
    updatePaginationInfo();
}

// Inicializa la aplicación cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
loadProfessionalsFromDB();

const digitalCertificateFilter =
    document.getElementById('digitalCertificateFilter');

digitalCertificateFilter.addEventListener('click', () => {
    digitalCertificateOnly = !digitalCertificateOnly;

    digitalCertificateFilter.classList.toggle(
        'active',
        digitalCertificateOnly
    );

    digitalCertificateFilter.setAttribute(
        'aria-pressed',
        String(digitalCertificateOnly)
    );

    updateProfessionals();
});


    document.getElementById('recordsPerPage').addEventListener('change', updateRecordsPerPage);
    document.getElementById('search').addEventListener('input', updateProfessionals);
    document.getElementById('specialtyFilter').addEventListener('change', updateProfessionals);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
});

// Llama a la función para cargar la API de Google Maps de manera asíncrona
/*function loadGoogleMapsAPI() {
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
    }
}

function initMap() {
    // Función de inicialización del mapa
    // Esta función puede estar vacía si solo estás usando el iframe para mostrar el mapa
}

// Llama a la función para cargar la API de Google Maps
loadGoogleMapsAPI();*/